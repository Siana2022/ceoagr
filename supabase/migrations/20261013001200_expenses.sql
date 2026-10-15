-- Expenses and travel reports with an approval flow. Requires 20261013000700_time_tracking.sql.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  expense_date date not null default current_date,
  kind text not null check (kind in ('kilometraje', 'dieta', 'alojamiento', 'transporte', 'material', 'otros')),
  description text,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),       -- km, days or 1
  unit_amount numeric(10, 2) not null check (unit_amount >= 0),          -- EUR per km / per day / the amount
  amount numeric(12, 2) generated always as (round(quantity * unit_amount, 2)) stored,
  billable boolean not null default false,                              -- re-billed to the client
  receipt_path text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'reimbursed')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  reimbursed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index expenses_org_id_idx on public.expenses (org_id);
create index expenses_user_idx on public.expenses (user_id, expense_date desc);
create index expenses_case_idx on public.expenses (case_id);
create index expenses_status_idx on public.expenses (org_id, status);

create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger expenses_audit
  after insert or update or delete on public.expenses
  for each row execute function public.audit_row_change();

-- A rejected expense that the owner corrects goes back to the approver clean.
create function public.expenses_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  if new.status = 'submitted' and old.status = 'rejected' then
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := null;
  end if;
  return new;
end;
$$;

create trigger expenses_before_update
  before update on public.expenses
  for each row execute function public.expenses_before_update();

alter table public.expenses enable row level security;

create policy expenses_select on public.expenses
  for select to authenticated
  using (
    org_id = public.current_org_id() and (
      user_id = auth.uid()
      or public.current_user_role() in ('owner', 'admin')
      or (public.current_user_role() = 'manager' and public.same_team_as(user_id))
    )
  );

create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and user_id = auth.uid()
    and status = 'submitted'
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and (case_id is null or exists (
      select 1 from public.cases c where c.id = expenses.case_id and c.org_id = public.current_org_id()))
  );

-- Owners can edit or delete their expense until it is approved.
create policy expenses_update on public.expenses
  for update to authenticated
  using (org_id = public.current_org_id() and user_id = auth.uid() and status in ('submitted', 'rejected'))
  with check (org_id = public.current_org_id() and user_id = auth.uid() and status = 'submitted');

create policy expenses_delete on public.expenses
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and ((user_id = auth.uid() and status in ('submitted', 'rejected')) or public.is_org_admin())
  );

-- Approval flow. Nobody approves their own expense, except the organization owner.
create function public.decide_expense(p_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expenses;
  v_role public.app_role := public.current_user_role();
begin
  if p_decision not in ('approved', 'rejected', 'reimbursed') then
    raise exception 'invalid decision';
  end if;
  if v_role is null or v_role not in ('owner', 'admin', 'manager') then
    raise exception 'forbidden';
  end if;

  select * into e from public.expenses where id = p_id and org_id = public.current_org_id();
  if not found then
    raise exception 'expense not found';
  end if;
  if v_role = 'manager' and not public.same_team_as(e.user_id) then
    raise exception 'forbidden';
  end if;
  if e.user_id = auth.uid() and v_role <> 'owner' then
    raise exception 'you cannot decide your own expense';
  end if;

  if p_decision = 'reimbursed' then
    if v_role not in ('owner', 'admin') or e.status <> 'approved' then
      raise exception 'only approved expenses can be reimbursed, by an administrator';
    end if;
    update public.expenses set status = 'reimbursed', reimbursed_at = now() where id = p_id;
    return;
  end if;

  if e.status <> 'submitted' then
    raise exception 'expense already decided';
  end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'a reason is required to reject';
  end if;

  update public.expenses
  set status = p_decision, decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
  where id = p_id;
end;
$$;

create function public.set_expense_rates(p_km numeric, p_dieta numeric, p_dieta_overnight numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'readonly') not in ('owner', 'admin') then
    raise exception 'forbidden';
  end if;
  if p_km < 0 or p_km > 5 or p_dieta < 0 or p_dieta > 500 or p_dieta_overnight < 0 or p_dieta_overnight > 500 then
    raise exception 'invalid rates';
  end if;
  update public.organizations
  set settings = jsonb_set(
    coalesce(settings, '{}'::jsonb), '{expenses}',
    jsonb_build_object('km_rate', p_km, 'dieta', p_dieta, 'dieta_overnight', p_dieta_overnight), true)
  where id = public.current_org_id();
end;
$$;

-- security invoker: RLS decides which expenses the caller sees.
create function public.expense_report_rows(p_from date, p_to date)
returns table (case_id uuid, user_id uuid, approved_total numeric, billable_total numeric, pending_total numeric)
language sql
stable
set search_path = ''
as $$
  select
    e.case_id,
    e.user_id,
    sum(case when e.status in ('approved', 'reimbursed') then e.amount else 0 end),
    sum(case when e.status in ('approved', 'reimbursed') and e.billable then e.amount else 0 end),
    sum(case when e.status = 'submitted' then e.amount else 0 end)
  from public.expenses e
  where e.expense_date between p_from and p_to
  group by e.case_id, e.user_id;
$$;

revoke all on function public.decide_expense(uuid, text, text) from public, anon;
revoke all on function public.set_expense_rates(numeric, numeric, numeric) from public, anon;
revoke all on function public.expense_report_rows(date, date) from public, anon;
grant execute on function public.decide_expense(uuid, text, text) to authenticated;
grant execute on function public.set_expense_rates(numeric, numeric, numeric) to authenticated;
grant execute on function public.expense_report_rows(date, date) to authenticated;
