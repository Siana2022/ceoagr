-- People who have a task assigned on a case (or contact) can see it, so they can
-- work on it and log time. Requires 20261013000300_tasks.sql.

create or replace function public.can_view_record(p_entity text, p_id uuid, p_owner uuid, p_org uuid)
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
      or (p_entity = 'case' and exists (
        select 1 from public.tasks t
        where t.case_id = p_id and t.assignee_id = auth.uid()
      ))
    ), false);
$$;

create or replace function public.can_view_contact(p_id uuid, p_owner uuid, p_org uuid)
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
      or exists (
        select 1 from public.tasks t
        where t.contact_id = p_id and t.assignee_id = auth.uid()
      )
      or exists (
        select 1 from public.cases c
        where c.contact_id = p_id
          and public.can_view_record('case', c.id, c.owner_id, c.org_id)
      )
    ), false);
$$;
