-- Delivery 1: automatic tasks per case phase. Requires 20261013000300_tasks.sql.

create table public.case_task_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  case_type_id uuid not null references public.case_types (id) on delete cascade,
  status_key text not null,
  title text not null check (length(trim(title)) > 0),
  description text,
  assign_to text not null default 'owner' check (assign_to in ('owner', 'actor', 'none')),
  due_offset_days int check (due_offset_days is null or due_offset_days between 0 and 3650),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  checklist text[] not null default '{}',
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index case_task_templates_org_id_idx on public.case_task_templates (org_id);
create index case_task_templates_type_status_idx on public.case_task_templates (case_type_id, status_key);

create trigger case_task_templates_updated_at before update on public.case_task_templates
  for each row execute function public.set_updated_at();

alter table public.tasks add column template_id uuid references public.case_task_templates (id) on delete set null;
create index tasks_template_idx on public.tasks (case_id, template_id);

-- When a case enters a phase, create that phase's standard tasks (once per template).
create function public.cases_apply_task_templates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  v_task uuid;
  v_assignee uuid;
  v_count int := 0;
  v_item text;
  v_pos int;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  for t in
    select * from public.case_task_templates
    where case_type_id = new.case_type_id and status_key = new.status and active
    order by position, created_at
  loop
    if exists (select 1 from public.tasks where case_id = new.id and template_id = t.id) then
      continue;
    end if;

    v_assignee := case t.assign_to
      when 'owner' then new.owner_id
      when 'actor' then auth.uid()
      else null
    end;

    insert into public.tasks (org_id, case_id, title, description, priority, assignee_id, due_at, template_id, created_by)
    values (
      new.org_id, new.id, t.title, t.description, t.priority, v_assignee,
      case when t.due_offset_days is null then null else now() + make_interval(days => t.due_offset_days) end,
      t.id, coalesce(auth.uid(), new.created_by)
    )
    returning id into v_task;

    v_pos := 0;
    foreach v_item in array t.checklist loop
      insert into public.task_checklists (org_id, task_id, label, position)
      values (new.org_id, v_task, v_item, v_pos);
      v_pos := v_pos + 1;
    end loop;

    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    insert into public.case_events (org_id, case_id, event_type, actor_id, payload)
    values (new.org_id, new.id, 'tasks_created', auth.uid(),
            jsonb_build_object('count', v_count, 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger cases_task_templates
  after insert or update of status on public.cases
  for each row execute function public.cases_apply_task_templates();

revoke all on function public.cases_apply_task_templates() from public, anon;

alter table public.case_task_templates enable row level security;

create policy case_task_templates_select on public.case_task_templates
  for select to authenticated
  using (org_id = public.current_org_id());
create policy case_task_templates_insert on public.case_task_templates
  for insert to authenticated
  with check (
    org_id = public.current_org_id() and public.is_org_admin()
    and exists (select 1 from public.case_types t where t.id = case_task_templates.case_type_id and t.org_id = public.current_org_id())
  );
create policy case_task_templates_update on public.case_task_templates
  for update to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin())
  with check (org_id = public.current_org_id());
create policy case_task_templates_delete on public.case_task_templates
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());
