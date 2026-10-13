-- Phase 0: organizations, users, roles, invitations + base RLS.
-- One active organization per user (see docs/DECISIONS.md).

create type public.app_role as enum ('owner', 'admin', 'manager', 'member', 'readonly');

-- ---------------------------------------------------------------- tables

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index teams_org_id_idx on public.teams (org_id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.app_role not null default 'member',
  team_id uuid references public.teams (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index memberships_org_id_idx on public.memberships (org_id);
create index memberships_team_id_idx on public.memberships (team_id);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null,
  module text not null,
  action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, role, module, action)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.app_role not null default 'member',
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (role <> 'owner')
);
create index invitations_org_id_idx on public.invitations (org_id);
create index invitations_email_idx on public.invitations (lower(email));

-- ------------------------------------------------------- helper functions

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger role_permissions_updated_at before update on public.role_permissions
  for each row execute function public.set_updated_at();
create trigger invitations_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid() and m.active
  limit 1;
$$;

create function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.user_id = auth.uid() and m.active
  limit 1;
$$;

create function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin'), false);
$$;

-- Profile row created automatically for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- RPC flows

-- Creates an organization and makes the caller its owner.
create function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'user already belongs to an organization';
  end if;

  insert into public.organizations (name, slug)
  values (trim(p_name), lower(trim(p_slug)))
  returning id into v_org_id;

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  return v_org_id;
end;
$$;

-- Accepts an invitation by token; the caller's email must match.
create function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'user already belongs to an organization';
  end if;

  select * into v_inv from public.invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  for update;

  if not found then
    raise exception 'invalid or expired invitation';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, auth.uid(), v_inv.role);

  update public.invitations set accepted_at = now() where id = v_inv.id;

  return v_inv.org_id;
end;
$$;

revoke all on function public.current_org_id() from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_org_admin() from public, anon;
revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_org_admin() to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- -------------------------------------------------------------------- RLS

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.memberships enable row level security;
alter table public.role_permissions enable row level security;
alter table public.invitations enable row level security;

-- organizations: members read, admins update. Creation only via RPC.
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.current_org_id());
create policy organizations_update on public.organizations
  for update to authenticated
  using (id = public.current_org_id() and public.is_org_admin())
  with check (id = public.current_org_id() and public.is_org_admin());

-- profiles: own row, or members of the same organization.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = profiles.user_id and m.org_id = public.current_org_id()
    )
  );
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- teams
create policy teams_select on public.teams
  for select to authenticated
  using (org_id = public.current_org_id());
create policy teams_insert on public.teams
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_org_admin());
create policy teams_update on public.teams
  for update to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin())
  with check (org_id = public.current_org_id() and public.is_org_admin());
create policy teams_delete on public.teams
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

-- memberships: no direct insert (RPC only). Only owners touch owner rows.
create policy memberships_select on public.memberships
  for select to authenticated
  using (org_id = public.current_org_id());
create policy memberships_update on public.memberships
  for update to authenticated
  using (
    org_id = public.current_org_id() and public.is_org_admin()
    and (role <> 'owner' or public.current_user_role() = 'owner')
  )
  with check (
    org_id = public.current_org_id() and public.is_org_admin()
    and (role <> 'owner' or public.current_user_role() = 'owner')
  );
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (
    org_id = public.current_org_id() and public.is_org_admin()
    and (role <> 'owner' or public.current_user_role() = 'owner')
  );

-- role_permissions
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (org_id = public.current_org_id());
create policy role_permissions_insert on public.role_permissions
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_org_admin());
create policy role_permissions_update on public.role_permissions
  for update to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin())
  with check (org_id = public.current_org_id() and public.is_org_admin());
create policy role_permissions_delete on public.role_permissions
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

-- invitations: admins manage; acceptance goes through accept_invitation().
create policy invitations_select on public.invitations
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_org_admin());
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());
