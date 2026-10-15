-- Task dependencies (finish-to-start), used by the board and the Gantt chart.

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);
create index task_dependencies_org_id_idx on public.task_dependencies (org_id);
create index task_dependencies_task_idx on public.task_dependencies (task_id);
create index task_dependencies_depends_idx on public.task_dependencies (depends_on_task_id);

-- Both tasks must belong to the same case, and the graph must stay acyclic.
create function public.task_dependencies_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  b record;
begin
  select org_id, case_id into a from public.tasks where id = new.task_id;
  select org_id, case_id into b from public.tasks where id = new.depends_on_task_id;
  if a.org_id is null or b.org_id is null or a.org_id <> b.org_id then
    raise exception 'unknown task';
  end if;
  if a.case_id is distinct from b.case_id then
    raise exception 'dependencies must be between tasks of the same case';
  end if;

  if exists (
    with recursive upstream(id) as (
      select d.depends_on_task_id from public.task_dependencies d where d.task_id = new.depends_on_task_id
      union
      select d.depends_on_task_id from public.task_dependencies d join upstream u on d.task_id = u.id
    )
    select 1 from upstream where id = new.task_id
  ) then
    raise exception 'circular dependency';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_before_insert
  before insert on public.task_dependencies
  for each row execute function public.task_dependencies_before_insert();

revoke all on function public.task_dependencies_before_insert() from public, anon;

alter table public.task_dependencies enable row level security;

create policy task_dependencies_select on public.task_dependencies
  for select to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_dependencies.task_id
      and public.can_view_task(t.id, t.assignee_id, t.created_by, t.case_id, t.org_id)
  ));

create policy task_dependencies_insert on public.task_dependencies
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_dependencies.task_id
        and public.can_edit_task(t.id, t.assignee_id, t.created_by, t.case_id, t.org_id)
    )
    and exists (select 1 from public.tasks d where d.id = task_dependencies.depends_on_task_id)
  );

create policy task_dependencies_delete on public.task_dependencies
  for delete to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_dependencies.task_id
      and public.can_edit_task(t.id, t.assignee_id, t.created_by, t.case_id, t.org_id)
  ));
