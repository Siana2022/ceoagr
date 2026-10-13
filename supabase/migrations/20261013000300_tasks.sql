-- Phase 1 / Tasks: tasks, subtasks and checklists. Requires 20261013000200_cases.sql.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id uuid references auth.users (id) on delete set null,
  start_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  estimate_minutes int check (estimate_minutes is null or estimate_minutes >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index tasks_org_id_idx on public.tasks (org_id);
create index tasks_assignee_idx on public.tasks (assignee_id, status);
create index tasks_case_idx on public.tasks (case_id);
create index tasks_contact_idx on public.tasks (contact_id);
create index tasks_parent_idx on public.tasks (parent_task_id);
create index tasks_due_idx on public.tasks (org_id, due_at);
create index tasks_created_by_idx on public.tasks (created_by);

create table public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index task_checklists_org_id_idx on public.task_checklists (org_id);
create index task_checklists_task_idx on public.task_checklists (task_id);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

create trigger tasks_audit
  after insert or update or delete on public.tasks
  for each row execute function public.audit_row_change();

-- Visibility: admins/readonly see all; people see tasks assigned to or created by
-- them; managers also their team's; and anyone who can see the linked case.
create function public.can_view_task(p_id uuid, p_assignee uuid, p_created_by uuid, p_case uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_org = public.current_org_id() and (
      public.current_user_role() in ('owner', 'admin', 'readonly')
      or p_assignee = auth.uid()
      or p_created_by = auth.uid()
      or (public.current_user_role() = 'manager'
          and (public.same_team_as(p_assignee) or public.same_team_as(p_created_by)))
      or exists (
        select 1 from public.cases c
        where c.id = p_case and public.can_view_record('case', c.id, c.owner_id, c.org_id)
      )
    ), false);
$$;

create function public.can_edit_task(p_id uuid, p_assignee uuid, p_created_by uuid, p_case uuid, p_org uuid)
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
      or p_assignee = auth.uid()
      or p_created_by = auth.uid()
      or (public.current_user_role() = 'manager'
          and (public.same_team_as(p_assignee) or public.same_team_as(p_created_by)))
      or exists (
        select 1 from public.cases c
        where c.id = p_case and public.can_edit_record('case', c.id, c.owner_id, c.org_id)
      )
    ), false);
$$;

revoke all on function public.can_view_task(uuid, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.can_edit_task(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.can_view_task(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.can_edit_task(uuid, uuid, uuid, uuid, uuid) to authenticated;

alter table public.tasks enable row level security;
alter table public.task_checklists enable row level security;

create policy tasks_select on public.tasks
  for select to authenticated
  using (public.can_view_task(id, assignee_id, created_by, case_id, org_id));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and (case_id is null or exists (
      select 1 from public.cases c where c.id = tasks.case_id and c.org_id = public.current_org_id()))
    and (contact_id is null or exists (
      select 1 from public.contacts k where k.id = tasks.contact_id and k.org_id = public.current_org_id()))
    and (assignee_id is null or exists (
      select 1 from public.memberships m where m.user_id = tasks.assignee_id and m.org_id = public.current_org_id()))
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (public.can_edit_task(id, assignee_id, created_by, case_id, org_id))
  with check (
    org_id = public.current_org_id()
    and (assignee_id is null or exists (
      select 1 from public.memberships m where m.user_id = tasks.assignee_id and m.org_id = public.current_org_id()))
  );

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.can_edit_task(id, assignee_id, created_by, case_id, org_id));

-- checklist items follow their task
create policy task_checklists_select on public.task_checklists
  for select to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_checklists.task_id
      and public.can_view_task(t.id, t.assignee_id, t.created_by, t.case_id, t.org_id)
  ));
create policy task_checklists_insert on public.task_checklists
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_checklists.task_id
        and public.can_edit_task(t.id, t.assignee_id, t.created_by, t.case_id, t.org_id)
    )
  );
create policy task_checklists_update on public.task_checklists
  for update to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_checklists.task_id
      and public.can_edit_task(t.id, t.assignee_id, t.created_by, t.case_id, t.org_id)
  ))
  with check (org_id = public.current_org_id());
create policy task_checklists_delete on public.task_checklists
  for delete to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_checklists.task_id
      and public.can_edit_task(t.id, t.assignee_id, t.created_by, t.case_id, t.org_id)
  ));
