-- Phase 1 / Agenda: resources and appointments. Requires 20261013000200_cases.sql.
-- Availability rules/exceptions (online booking) arrive in phase 4.

create extension if not exists btree_gist with schema extensions;

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'professional' check (kind in ('professional', 'room', 'equipment')),
  color text not null default '#003366' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index resources_org_id_idx on public.resources (org_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'no_show')),
  title text not null check (length(trim(title)) > 0),
  notes text,
  source text not null default 'internal' check (source in ('internal', 'online')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (ends_at > starts_at),
  -- A resource cannot have two active appointments at the same time.
  constraint appointments_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);
create index appointments_org_id_idx on public.appointments (org_id);
create index appointments_resource_time_idx on public.appointments (resource_id, starts_at);
create index appointments_org_time_idx on public.appointments (org_id, starts_at);
create index appointments_contact_idx on public.appointments (contact_id);
create index appointments_case_idx on public.appointments (case_id);

create trigger resources_updated_at before update on public.resources
  for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger appointments_audit
  after insert or update or delete on public.appointments
  for each row execute function public.audit_row_change();

alter table public.resources enable row level security;
alter table public.appointments enable row level security;

-- resources: everyone reads; owner/admin/manager manage.
create policy resources_select on public.resources
  for select to authenticated
  using (org_id = public.current_org_id());
create policy resources_insert on public.resources
  for insert to authenticated
  with check (org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager'));
create policy resources_update on public.resources
  for update to authenticated
  using (org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager'))
  with check (org_id = public.current_org_id());
create policy resources_delete on public.resources
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin()
    and not exists (select 1 from public.appointments a where a.resource_id = resources.id));

-- appointments: the agenda is shared inside the organization (needed to detect
-- overlaps); only the creator or owner/admin/manager can change them.
create policy appointments_select on public.appointments
  for select to authenticated
  using (org_id = public.current_org_id());
create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and exists (select 1 from public.resources r where r.id = appointments.resource_id and r.org_id = public.current_org_id())
    and (contact_id is null or exists (
      select 1 from public.contacts k where k.id = appointments.contact_id and k.org_id = public.current_org_id()))
    and (case_id is null or exists (
      select 1 from public.cases c where c.id = appointments.case_id and c.org_id = public.current_org_id()))
  );
create policy appointments_update on public.appointments
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') <> 'readonly'
    and (created_by = auth.uid() or public.current_user_role() in ('owner', 'admin', 'manager'))
  )
  with check (org_id = public.current_org_id());
create policy appointments_delete on public.appointments
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') <> 'readonly'
    and (created_by = auth.uid() or public.current_user_role() in ('owner', 'admin', 'manager'))
  );
