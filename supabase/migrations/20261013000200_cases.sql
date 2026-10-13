-- Phase 1 / Cases: configurable case types, cases, history, participants.
-- Requires 20261013000100_contacts.sql.

-- Generic visibility helpers for records owned by a user (same model as contacts).
create function public.can_view_record(p_entity text, p_id uuid, p_owner uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_org = public.current_org_id() and (
      public.current_user_role() in ('owner', 'admin', 'readonly')
      or p_owner = auth.uid()
      or (public.current_user_role() = 'manager' and public.same_team_as(p_owner))
      or exists (
        select 1 from public.record_shares s
        where s.entity = p_entity and s.entity_id = p_id and s.user_id = auth.uid()
      )
    ), false);
$$;

create function public.can_edit_record(p_entity text, p_id uuid, p_owner uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_org = public.current_org_id()
    and public.current_user_role() <> 'readonly'
    and (
      public.current_user_role() in ('owner', 'admin')
      or p_owner = auth.uid()
      or (public.current_user_role() = 'manager' and public.same_team_as(p_owner))
      or exists (
        select 1 from public.record_shares s
        where s.entity = p_entity and s.entity_id = p_id
          and s.user_id = auth.uid() and s.permission = 'edit'
      )
    ), false);
$$;

-- ------------------------------------------------------------------ tables

create table public.case_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null,
  icon text,
  label_singular text not null default 'Expediente',
  label_plural text not null default 'Expedientes',
  code_prefix text not null default 'EXP' check (code_prefix ~ '^[A-Z0-9]{2,8}$'),
  custom_schema jsonb not null default '[]'::jsonb,
  pipeline jsonb not null default '[
    {"key":"nuevo","label":"Nuevo","color":"#64748b","initial":true},
    {"key":"en_curso","label":"En curso","color":"#0369a1"},
    {"key":"cerrado","label":"Cerrado","color":"#15803d","final":true}
  ]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, slug)
);
create index case_types_org_id_idx on public.case_types (org_id);

create table public.case_counters (
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_type_id uuid not null references public.case_types (id) on delete cascade,
  year int not null,
  last int not null default 0,
  primary key (case_type_id, year)
);
create index case_counters_org_id_idx on public.case_counters (org_id);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete restrict,
  case_type_id uuid not null references public.case_types (id) on delete restrict,
  code text not null,
  title text not null check (length(trim(title)) > 0),
  status text not null default '',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  owner_id uuid default auth.uid() references auth.users (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  closed_at timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  budget_hours numeric(10, 2),
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, code)
);
create index cases_org_id_idx on public.cases (org_id);
create index cases_contact_id_idx on public.cases (contact_id);
create index cases_type_status_idx on public.cases (case_type_id, status);
create index cases_owner_id_idx on public.cases (owner_id);
create index cases_team_id_idx on public.cases (team_id);
create index cases_due_at_idx on public.cases (org_id, due_at);
create index cases_title_trgm_idx on public.cases using gin (title extensions.gin_trgm_ops);
create index cases_code_trgm_idx on public.cases using gin (code extensions.gin_trgm_ops);

create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  event_type text not null,
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index case_events_org_id_idx on public.case_events (org_id);
create index case_events_case_idx on public.case_events (case_id, created_at desc);

create table public.case_participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (case_id, contact_id)
);
create index case_participants_org_id_idx on public.case_participants (org_id);
create index case_participants_contact_idx on public.case_participants (contact_id);

create trigger case_types_updated_at before update on public.case_types
  for each row execute function public.set_updated_at();
create trigger cases_updated_at before update on public.cases
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- code & status

create function public.next_case_code(p_type uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.case_types;
  v_year int := extract(year from now())::int;
  v_n int;
begin
  select * into v_type from public.case_types
  where id = p_type and org_id = public.current_org_id();
  if not found then
    raise exception 'unknown case type';
  end if;

  insert into public.case_counters (org_id, case_type_id, year, last)
  values (v_type.org_id, p_type, v_year, 1)
  on conflict (case_type_id, year)
  do update set last = public.case_counters.last + 1
  returning last into v_n;

  return v_type.code_prefix || '-' || v_year || '-' || lpad(v_n::text, 4, '0');
end;
$$;

create function public.case_status_flags(p_type uuid, p_status text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s from public.case_types t, jsonb_array_elements(t.pipeline) s
  where t.id = p_type and s ->> 'key' = p_status
  limit 1;
$$;

create function public.cases_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_initial text;
  v_flags jsonb;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.code, '') = '' then
      new.code := public.next_case_code(new.case_type_id);
    end if;
    if coalesce(new.status, '') = '' then
      select s ->> 'key' into v_initial
      from public.case_types t, jsonb_array_elements(t.pipeline) s
      where t.id = new.case_type_id and (s ->> 'initial')::boolean is true
      limit 1;
      if v_initial is null then
        select t.pipeline -> 0 ->> 'key' into v_initial
        from public.case_types t where t.id = new.case_type_id;
      end if;
      new.status := coalesce(v_initial, 'nuevo');
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    v_flags := public.case_status_flags(new.case_type_id, new.status);
    if v_flags is null then
      raise exception 'invalid status % for this case type', new.status;
    end if;
    if (v_flags ->> 'final')::boolean is true then
      new.closed_at := coalesce(new.closed_at, now());
    else
      new.closed_at := null;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.code := old.code;
    new.case_type_id := old.case_type_id;
  end if;
  return new;
end;
$$;

create trigger cases_before_write
  before insert or update on public.cases
  for each row execute function public.cases_before_write();

-- ----------------------------------------------------------- case history

create function public.cases_log_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.case_events (org_id, case_id, event_type, actor_id, payload)
    values (new.org_id, new.id, 'created', auth.uid(),
            jsonb_build_object('code', new.code, 'status', new.status));
  else
    if new.status is distinct from old.status then
      insert into public.case_events (org_id, case_id, event_type, actor_id, payload)
      values (new.org_id, new.id, 'status_changed', auth.uid(),
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.owner_id is distinct from old.owner_id then
      insert into public.case_events (org_id, case_id, event_type, actor_id, payload)
      values (new.org_id, new.id, 'owner_changed', auth.uid(),
              jsonb_build_object('from', old.owner_id, 'to', new.owner_id));
    end if;
    if new.archived is distinct from old.archived then
      insert into public.case_events (org_id, case_id, event_type, actor_id, payload)
      values (new.org_id, new.id, case when new.archived then 'archived' else 'restored' end,
              auth.uid(), '{}'::jsonb);
    end if;
  end if;
  return new;
end;
$$;

create trigger cases_log_events
  after insert or update on public.cases
  for each row execute function public.cases_log_events();

create trigger cases_audit
  after insert or update or delete on public.cases
  for each row execute function public.audit_row_change();

-- ------------------------------------------------------------------ grants

revoke all on function public.can_view_record(text, uuid, uuid, uuid) from public, anon;
revoke all on function public.can_edit_record(text, uuid, uuid, uuid) from public, anon;
revoke all on function public.next_case_code(uuid) from public, anon;
revoke all on function public.case_status_flags(uuid, text) from public, anon;
revoke all on function public.cases_log_events() from public, anon;
grant execute on function public.can_view_record(text, uuid, uuid, uuid) to authenticated;
grant execute on function public.can_edit_record(text, uuid, uuid, uuid) to authenticated;
grant execute on function public.next_case_code(uuid) to authenticated;
grant execute on function public.case_status_flags(uuid, text) to authenticated;

-- --------------------------------------------------------------------- RLS

alter table public.case_types enable row level security;
alter table public.case_counters enable row level security;
alter table public.cases enable row level security;
alter table public.case_events enable row level security;
alter table public.case_participants enable row level security;

-- case_types: everyone in the org reads, owner/admin configure.
create policy case_types_select on public.case_types
  for select to authenticated
  using (org_id = public.current_org_id());
create policy case_types_insert on public.case_types
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_org_admin());
create policy case_types_update on public.case_types
  for update to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin())
  with check (org_id = public.current_org_id() and public.is_org_admin());
create policy case_types_delete on public.case_types
  for delete to authenticated
  using (
    org_id = public.current_org_id() and public.is_org_admin()
    and not exists (select 1 from public.cases c where c.case_type_id = case_types.id)
  );

-- case_counters: no policies (only the SECURITY DEFINER function touches it).

-- cases
create policy cases_select on public.cases
  for select to authenticated
  using (public.can_view_record('case', id, owner_id, org_id));

create policy cases_insert on public.cases
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and (public.current_user_role() in ('owner', 'admin', 'manager') or owner_id = auth.uid())
    and exists (select 1 from public.contacts c where c.id = cases.contact_id and c.org_id = public.current_org_id())
    and exists (select 1 from public.case_types t where t.id = cases.case_type_id and t.org_id = public.current_org_id())
  );

create policy cases_update on public.cases
  for update to authenticated
  using (public.can_edit_record('case', id, owner_id, org_id))
  with check (org_id = public.current_org_id());

create policy cases_delete on public.cases
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

-- case_events: readable with the case; written by the trigger only.
create policy case_events_select on public.case_events
  for select to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_events.case_id
      and public.can_view_record('case', c.id, c.owner_id, c.org_id)
  ));

-- case_participants follow the case.
create policy case_participants_select on public.case_participants
  for select to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_participants.case_id
      and public.can_view_record('case', c.id, c.owner_id, c.org_id)
  ));
create policy case_participants_insert on public.case_participants
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.cases c
      where c.id = case_participants.case_id
        and public.can_edit_record('case', c.id, c.owner_id, c.org_id)
    )
    and exists (select 1 from public.contacts k where k.id = case_participants.contact_id and k.org_id = public.current_org_id())
  );
create policy case_participants_delete on public.case_participants
  for delete to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_participants.case_id
      and public.can_edit_record('case', c.id, c.owner_id, c.org_id)
  ));
