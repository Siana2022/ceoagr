-- Automations / RPA (spec 5.14): "when a case/opportunity reaches a status,
-- create a task and/or call a webhook". Webhooks are outbound only, signed
-- with HMAC so n8n (or any receiver) can verify they came from this app.
-- Requires 20261013000200_cases.sql and 20261013000800_opportunities.sql.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net;

-- ---------------------------------------------------------- webhook secret

create table public.automation_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  webhook_secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  updated_at timestamptz not null default now()
);

alter table public.automation_settings enable row level security;

-- Admins only; written exclusively through the SECURITY DEFINER RPCs below.
create policy automation_settings_select on public.automation_settings
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

create function public.ensure_automation_secret()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_secret text;
begin
  if coalesce(public.current_user_role(), 'readonly') not in ('owner', 'admin') then
    raise exception 'forbidden';
  end if;
  insert into public.automation_settings (org_id) values (v_org)
  on conflict (org_id) do nothing;
  select webhook_secret into v_secret from public.automation_settings where org_id = v_org;
  return v_secret;
end;
$$;

create function public.regenerate_automation_secret()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_secret text;
begin
  if coalesce(public.current_user_role(), 'readonly') not in ('owner', 'admin') then
    raise exception 'forbidden';
  end if;
  v_secret := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.automation_settings (org_id, webhook_secret, updated_at)
  values (v_org, v_secret, now())
  on conflict (org_id) do update set webhook_secret = excluded.webhook_secret, updated_at = now();
  return v_secret;
end;
$$;

-- ---------------------------------------------------------------- automations

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  entity text not null check (entity in ('case', 'opportunity')),
  case_type_id uuid references public.case_types (id) on delete cascade,
  to_status text not null check (length(trim(to_status)) between 1 and 60),
  actions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (entity = 'case' or case_type_id is null)
);
create index automations_org_id_idx on public.automations (org_id);
create index automations_lookup_idx on public.automations (org_id, entity, to_status) where active;

create trigger automations_updated_at before update on public.automations
  for each row execute function public.set_updated_at();

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid references public.automations (id) on delete set null,
  entity text not null,
  entity_id uuid not null,
  action_type text not null,
  status text not null check (status in ('ok', 'error')),
  detail text,
  created_at timestamptz not null default now()
);
create index automation_runs_org_id_idx on public.automation_runs (org_id, created_at desc);
create index automation_runs_automation_idx on public.automation_runs (automation_id, created_at desc);

-- -------------------------------------------------------------- execution
-- One action never aborts the triggering update, or another action/automation:
-- failures are swallowed and logged to automation_runs instead of raised.

create function public.run_automation_action(
  p_org uuid, p_automation_id uuid, p_entity text, p_entity_id uuid,
  p_contact_id uuid, p_owner_id uuid, p_action jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := p_action ->> 'type';
  v_secret text;
  v_url text;
  v_payload jsonb;
  v_sig text;
  v_task uuid;
begin
  if v_type = 'create_task' then
    insert into public.tasks (org_id, case_id, contact_id, title, description, priority, assignee_id, due_at, created_by)
    values (
      p_org,
      case when p_entity = 'case' then p_entity_id end,
      case when p_entity = 'opportunity' then p_contact_id end,
      coalesce(nullif(trim(p_action ->> 'title'), ''), 'Tarea automática'),
      nullif(p_action ->> 'description', ''),
      coalesce(p_action ->> 'priority', 'normal'),
      case when coalesce(p_action ->> 'assign_to', 'owner') = 'owner' then p_owner_id end,
      case when (p_action ->> 'due_offset_days') is not null
           then now() + make_interval(days => greatest(0, least(3650, (p_action ->> 'due_offset_days')::int))) end,
      p_owner_id
    )
    returning id into v_task;

    insert into public.automation_runs (org_id, automation_id, entity, entity_id, action_type, status, detail)
    values (p_org, p_automation_id, p_entity, p_entity_id, 'create_task', 'ok', v_task::text);

  elsif v_type = 'webhook' then
    v_url := p_action ->> 'url';
    if v_url is null or v_url !~ '^https?://' then
      insert into public.automation_runs (org_id, automation_id, entity, entity_id, action_type, status, detail)
      values (p_org, p_automation_id, p_entity, p_entity_id, 'webhook', 'error', 'URL no válida');
      return;
    end if;

    select webhook_secret into v_secret from public.automation_settings where org_id = p_org;
    if v_secret is null then
      insert into public.automation_runs (org_id, automation_id, entity, entity_id, action_type, status, detail)
      values (p_org, p_automation_id, p_entity, p_entity_id, 'webhook', 'error', 'Sin clave de firma configurada');
      return;
    end if;

    v_payload := jsonb_build_object(
      'entity', p_entity, 'entity_id', p_entity_id, 'org_id', p_org,
      'automation_id', p_automation_id, 'to_status', p_action ->> '_to_status', 'occurred_at', now()
    );
    v_sig := encode(extensions.hmac(convert_to(v_payload::text, 'utf8'), v_secret, 'sha256'), 'hex');

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Signature', 'sha256=' || v_sig),
      body := v_payload
    );
    insert into public.automation_runs (org_id, automation_id, entity, entity_id, action_type, status, detail)
    values (p_org, p_automation_id, p_entity, p_entity_id, 'webhook', 'ok', 'Petición encolada a ' || v_url);
  else
    insert into public.automation_runs (org_id, automation_id, entity, entity_id, action_type, status, detail)
    values (p_org, p_automation_id, p_entity, p_entity_id, coalesce(v_type, 'desconocido'), 'error', 'Tipo de acción desconocido');
  end if;
exception when others then
  insert into public.automation_runs (org_id, automation_id, entity, entity_id, action_type, status, detail)
  values (p_org, p_automation_id, p_entity, p_entity_id, coalesce(v_type, 'desconocido'), 'error', sqlerrm);
end;
$$;

create function public.cases_run_automations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  act jsonb;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  for a in
    select * from public.automations
    where org_id = new.org_id and entity = 'case' and to_status = new.status and active
      and (case_type_id is null or case_type_id = new.case_type_id)
  loop
    for act in select * from jsonb_array_elements(a.actions) loop
      perform public.run_automation_action(new.org_id, a.id, 'case', new.id, new.contact_id, new.owner_id, act || jsonb_build_object('_to_status', new.status));
    end loop;
  end loop;
  return new;
end;
$$;

create trigger cases_automations
  after insert or update of status on public.cases
  for each row execute function public.cases_run_automations();

create function public.opportunities_run_automations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  act jsonb;
begin
  if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;
  for a in
    select * from public.automations
    where org_id = new.org_id and entity = 'opportunity' and to_status = new.stage and active
  loop
    for act in select * from jsonb_array_elements(a.actions) loop
      perform public.run_automation_action(new.org_id, a.id, 'opportunity', new.id, new.contact_id, new.owner_id, act || jsonb_build_object('_to_status', new.stage));
    end loop;
  end loop;
  return new;
end;
$$;

create trigger opportunities_automations
  after insert or update of stage on public.opportunities
  for each row execute function public.opportunities_run_automations();

revoke all on function public.ensure_automation_secret() from public, anon;
revoke all on function public.regenerate_automation_secret() from public, anon;
revoke all on function public.run_automation_action(uuid, uuid, text, uuid, uuid, uuid, jsonb) from public, anon;
revoke all on function public.cases_run_automations() from public, anon;
revoke all on function public.opportunities_run_automations() from public, anon;
grant execute on function public.ensure_automation_secret() to authenticated;
grant execute on function public.regenerate_automation_secret() to authenticated;

-- --------------------------------------------------------------------- RLS

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

-- Readable by the whole org (so people understand why a task appeared
-- "automatically"); only owner/admin configure them.
create policy automations_select on public.automations
  for select to authenticated
  using (org_id = public.current_org_id());

create policy automations_insert on public.automations
  for insert to authenticated
  with check (
    org_id = public.current_org_id() and public.is_org_admin()
    and (case_type_id is null or exists (
      select 1 from public.case_types ct where ct.id = automations.case_type_id and ct.org_id = public.current_org_id()))
  );

create policy automations_update on public.automations
  for update to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin())
  with check (
    org_id = public.current_org_id() and public.is_org_admin()
    and (case_type_id is null or exists (
      select 1 from public.case_types ct where ct.id = automations.case_type_id and ct.org_id = public.current_org_id()))
  );

create policy automations_delete on public.automations
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

create policy automation_runs_select on public.automation_runs
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());
-- automation_runs is written exclusively by the SECURITY DEFINER trigger chain.
