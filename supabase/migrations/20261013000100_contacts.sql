-- Phase 1 / Contacts: contacts, relations, sharing, audit log, required-fields setting.

create extension if not exists pg_trgm with schema extensions;

-- ----------------------------------------------------------- team helpers

create function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.team_id from public.memberships m
  where m.user_id = auth.uid() and m.active
  limit 1;
$$;

create function public.same_team_as(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1 from public.memberships m
    where m.user_id = p_user and m.active
      and m.team_id is not null
      and m.team_id = public.current_team_id()
  ), false);
$$;

-- ------------------------------------------------------------------ tables

create table public.record_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (entity, entity_id, user_id)
);
create index record_shares_org_id_idx on public.record_shares (org_id);
create index record_shares_user_idx on public.record_shares (user_id, entity);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('person', 'company')),
  name text not null check (length(trim(name)) > 0),
  legal_name text,
  tax_id text,
  email text,
  phone text,
  mobile text,
  address jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  source text,
  owner_id uuid default auth.uid() references auth.users (id) on delete set null,
  custom_fields jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  search tsvector generated always as (
    to_tsvector('spanish',
      coalesce(name, '') || ' ' || coalesce(legal_name, '') || ' ' ||
      coalesce(email, '') || ' ' || coalesce(tax_id, '') || ' ' ||
      coalesce(phone, '') || ' ' || coalesce(mobile, ''))
  ) stored
);
create index contacts_org_id_idx on public.contacts (org_id);
create index contacts_owner_id_idx on public.contacts (owner_id);
create index contacts_org_name_idx on public.contacts (org_id, name);
create index contacts_tags_idx on public.contacts using gin (tags);
create index contacts_search_idx on public.contacts using gin (search);
create index contacts_name_trgm_idx on public.contacts using gin (name extensions.gin_trgm_ops);
create index contacts_email_trgm_idx on public.contacts using gin (email extensions.gin_trgm_ops);
create index contacts_email_dup_idx on public.contacts (org_id, lower(email)) where email is not null;
create index contacts_tax_id_dup_idx on public.contacts (org_id, tax_id) where tax_id is not null;

create table public.contact_relations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  related_contact_id uuid not null references public.contacts (id) on delete cascade,
  relation_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (contact_id <> related_contact_id)
);
create index contact_relations_org_id_idx on public.contact_relations (org_id);
create index contact_relations_contact_idx on public.contact_relations (contact_id);
create index contact_relations_related_idx on public.contact_relations (related_contact_id);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_id_idx on public.audit_log (org_id);
create index audit_log_entity_idx on public.audit_log (org_id, entity, entity_id, created_at desc);

create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger contact_relations_updated_at before update on public.contact_relations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------- visibility functions

create function public.can_view_contact(p_id uuid, p_owner uuid, p_org uuid)
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
        where s.entity = 'contact' and s.entity_id = p_id and s.user_id = auth.uid()
      )
    ), false);
$$;

create function public.can_edit_contact(p_id uuid, p_owner uuid, p_org uuid)
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
        where s.entity = 'contact' and s.entity_id = p_id
          and s.user_id = auth.uid() and s.permission = 'edit'
      )
    ), false);
$$;

-- ------------------------------------------------------------- audit trigger

create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diff jsonb;
  v_org uuid;
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_org := new.org_id;
    v_id := new.id;
    v_diff := to_jsonb(new) - 'search';
  elsif tg_op = 'UPDATE' then
    v_org := new.org_id;
    v_id := new.id;
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      into v_diff
    from jsonb_each(to_jsonb(new)) n
    left join jsonb_each(to_jsonb(old)) o on o.key = n.key
    where n.key not in ('search', 'updated_at')
      and n.value is distinct from o.value;
    if v_diff = '{}'::jsonb then
      return new;
    end if;
  else
    v_org := old.org_id;
    v_id := old.id;
    v_diff := to_jsonb(old) - 'search';
  end if;

  insert into public.audit_log (org_id, actor_id, entity, entity_id, action, diff)
  values (v_org, auth.uid(), tg_table_name, v_id, lower(tg_op), v_diff);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger contacts_audit
  after insert or update or delete on public.contacts
  for each row execute function public.audit_row_change();

-- ------------------------------------------------- required-fields setting

create function public.set_contact_required_fields(p_fields text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'readonly') not in ('owner', 'admin', 'manager') then
    raise exception 'forbidden';
  end if;
  if not (p_fields <@ array['email', 'phone', 'mobile', 'tax_id', 'legal_name', 'source']) then
    raise exception 'invalid field';
  end if;

  update public.organizations
  set settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{contacts}',
    jsonb_build_object('required_fields', to_jsonb(p_fields)),
    true)
  where id = public.current_org_id();
end;
$$;

-- ------------------------------------------------------------------ grants

revoke all on function public.current_team_id() from public, anon;
revoke all on function public.same_team_as(uuid) from public, anon;
revoke all on function public.can_view_contact(uuid, uuid, uuid) from public, anon;
revoke all on function public.can_edit_contact(uuid, uuid, uuid) from public, anon;
revoke all on function public.audit_row_change() from public, anon;
revoke all on function public.set_contact_required_fields(text[]) from public, anon;
grant execute on function public.current_team_id() to authenticated;
grant execute on function public.same_team_as(uuid) to authenticated;
grant execute on function public.can_view_contact(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_edit_contact(uuid, uuid, uuid) to authenticated;
grant execute on function public.set_contact_required_fields(text[]) to authenticated;

-- --------------------------------------------------------------------- RLS

alter table public.record_shares enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_relations enable row level security;
alter table public.audit_log enable row level security;

-- contacts
create policy contacts_select on public.contacts
  for select to authenticated
  using (public.can_view_contact(id, owner_id, org_id));

create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and (
      public.current_user_role() in ('owner', 'admin', 'manager')
      or owner_id = auth.uid()
    )
  );

create policy contacts_update on public.contacts
  for update to authenticated
  using (public.can_edit_contact(id, owner_id, org_id))
  with check (org_id = public.current_org_id());

create policy contacts_delete on public.contacts
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

-- contact_relations follow the visibility of the contacts they link
create policy contact_relations_select on public.contact_relations
  for select to authenticated
  using (exists (
    select 1 from public.contacts c
    where c.id = contact_relations.contact_id
      and public.can_view_contact(c.id, c.owner_id, c.org_id)
  ));
create policy contact_relations_insert on public.contact_relations
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.contacts c
      where c.id = contact_relations.contact_id
        and public.can_edit_contact(c.id, c.owner_id, c.org_id)
    )
  );
create policy contact_relations_delete on public.contact_relations
  for delete to authenticated
  using (exists (
    select 1 from public.contacts c
    where c.id = contact_relations.contact_id
      and public.can_edit_contact(c.id, c.owner_id, c.org_id)
  ));

-- record_shares: admins, the sharer and the recipient can see them
create policy record_shares_select on public.record_shares
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (public.is_org_admin() or user_id = auth.uid() or created_by = auth.uid())
  );
create policy record_shares_insert on public.record_shares
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and entity = 'contact'
    and exists (
      select 1 from public.contacts c
      where c.id = record_shares.entity_id
        and public.can_edit_contact(c.id, c.owner_id, c.org_id)
    )
  );
create policy record_shares_delete on public.record_shares
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and (public.is_org_admin() or created_by = auth.uid())
  );

-- audit_log: read-only for admins; rows are written by the trigger only
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());
