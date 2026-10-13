-- Delivery 2: time entries, rates, budget alerts and notifications.
-- Requires 20261013000200_cases.sql.

alter table public.cases add column fee_amount numeric(12, 2)
  check (fee_amount is null or fee_amount >= 0);

-- --------------------------------------------------------------- rates
create table public.member_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cost_per_hour numeric(10, 2) not null check (cost_per_hour >= 0),
  price_per_hour numeric(10, 2) not null default 0 check (price_per_hour >= 0),
  valid_from date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (user_id, valid_from)
);
create index member_rates_org_id_idx on public.member_rates (org_id);
create index member_rates_user_idx on public.member_rates (user_id, valid_from desc);

-- ---------------------------------------------------------- time entries
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes int check (minutes is null or (minutes >= 0 and minutes <= 1440)),
  billable boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (ended_at is null or ended_at >= started_at)
);
create index time_entries_org_id_idx on public.time_entries (org_id);
create index time_entries_user_idx on public.time_entries (user_id, started_at desc);
create index time_entries_case_idx on public.time_entries (case_id, started_at);
create unique index time_entries_one_running_idx on public.time_entries (user_id) where ended_at is null;

create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

create function public.time_entries_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.started_at > now() + interval '1 day' then
    raise exception 'time entry cannot start in the future';
  end if;
  if new.ended_at is null and new.minutes is not null then
    -- manual entry: start + duration
    new.ended_at := new.started_at + make_interval(mins => new.minutes);
  elsif new.ended_at is not null then
    new.minutes := greatest(0, round(extract(epoch from (new.ended_at - new.started_at)) / 60))::int;
    if new.minutes > 1440 then
      raise exception 'time entry longer than 24 hours';
    end if;
  else
    new.minutes := null; -- running timer
  end if;
  return new;
end;
$$;

create trigger time_entries_before_write
  before insert or update on public.time_entries
  for each row execute function public.time_entries_before_write();
create trigger time_entries_audit
  after insert or update or delete on public.time_entries
  for each row execute function public.audit_row_change();

-- ----------------------------------------------- notifications & alerts
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_org_id_idx on public.notifications (org_id);

create table public.case_alerts (
  case_id uuid not null references public.cases (id) on delete cascade,
  threshold int not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, threshold)
);
create index case_alerts_org_id_idx on public.case_alerts (org_id);

create function public.time_entries_check_budget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_settings jsonb;
  v_total numeric;
  v_pct numeric;
  v_th int;
  v_user uuid;
begin
  if new.case_id is null or new.ended_at is null then
    return new;
  end if;

  select id, org_id, code, title, owner_id, budget_hours into c
  from public.cases where id = new.case_id;
  if not found or c.budget_hours is null or c.budget_hours <= 0 then
    return new;
  end if;

  select coalesce(sum(minutes), 0) / 60.0 into v_total
  from public.time_entries where case_id = new.case_id and ended_at is not null;
  v_pct := v_total / c.budget_hours * 100;

  select settings -> 'time' -> 'alert_thresholds' into v_settings
  from public.organizations where id = c.org_id;

  for v_th in
    select value::int from jsonb_array_elements_text(coalesce(v_settings, '[80, 100]'::jsonb))
  loop
    if v_pct >= v_th and not exists (
      select 1 from public.case_alerts where case_id = c.id and threshold = v_th
    ) then
      insert into public.case_alerts (case_id, threshold, org_id) values (c.id, v_th, c.org_id);

      for v_user in
        select distinct m.user_id from public.memberships m
        where m.org_id = c.org_id and m.active
          and (m.user_id = c.owner_id or m.role in ('owner', 'admin'))
      loop
        insert into public.notifications (org_id, user_id, kind, payload)
        values (c.org_id, v_user, 'budget_alert', jsonb_build_object(
          'case_id', c.id, 'code', c.code, 'title', c.title, 'threshold', v_th,
          'pct', round(v_pct), 'hours', round(v_total, 1), 'budget', c.budget_hours));
      end loop;
    end if;
  end loop;
  return new;
end;
$$;

create trigger time_entries_check_budget
  after insert or update on public.time_entries
  for each row execute function public.time_entries_check_budget();

create function public.set_time_alert_thresholds(p_values int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'readonly') not in ('owner', 'admin', 'manager') then
    raise exception 'forbidden';
  end if;
  if exists (select 1 from unnest(p_values) v where v < 1 or v > 500) or cardinality(p_values) > 6 then
    raise exception 'invalid thresholds';
  end if;
  update public.organizations
  set settings = jsonb_set(
    coalesce(settings, '{}'::jsonb), '{time}',
    jsonb_build_object('alert_thresholds', to_jsonb(p_values)), true)
  where id = public.current_org_id();
end;
$$;

-- ---------------------------------------------------------------- report
-- security invoker: RLS decides which entries and rates the caller can see.
-- cost is null when the caller cannot read the rates.
create function public.time_report_rows(p_from date, p_to date)
returns table (case_id uuid, user_id uuid, minutes bigint, billable_minutes bigint, cost numeric)
language sql
stable
set search_path = ''
as $$
  select
    e.case_id,
    e.user_id,
    sum(e.minutes)::bigint,
    sum(case when e.billable then e.minutes else 0 end)::bigint,
    sum(e.minutes / 60.0 * r.cost_per_hour)
  from public.time_entries e
  left join lateral (
    select mr.cost_per_hour from public.member_rates mr
    where mr.user_id = e.user_id
      and mr.valid_from <= (e.started_at at time zone 'Europe/Madrid')::date
    order by mr.valid_from desc
    limit 1
  ) r on true
  where e.ended_at is not null
    and (e.started_at at time zone 'Europe/Madrid')::date between p_from and p_to
  group by e.case_id, e.user_id;
$$;

revoke all on function public.time_entries_check_budget() from public, anon;
revoke all on function public.set_time_alert_thresholds(int[]) from public, anon;
revoke all on function public.time_report_rows(date, date) from public, anon;
grant execute on function public.set_time_alert_thresholds(int[]) to authenticated;
grant execute on function public.time_report_rows(date, date) to authenticated;

-- --------------------------------------------------------------------- RLS
alter table public.member_rates enable row level security;
alter table public.time_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.case_alerts enable row level security;

create policy member_rates_select on public.member_rates
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());
create policy member_rates_insert on public.member_rates
  for insert to authenticated
  with check (
    org_id = public.current_org_id() and public.is_org_admin()
    and exists (select 1 from public.memberships m where m.user_id = member_rates.user_id and m.org_id = public.current_org_id())
  );
create policy member_rates_update on public.member_rates
  for update to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin())
  with check (org_id = public.current_org_id());
create policy member_rates_delete on public.member_rates
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    org_id = public.current_org_id() and (
      user_id = auth.uid()
      or public.current_user_role() in ('owner', 'admin')
      or (public.current_user_role() = 'manager' and public.same_team_as(user_id))
    )
  );
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and (user_id = auth.uid() or public.is_org_admin())
    and (case_id is null or exists (
      select 1 from public.cases c where c.id = time_entries.case_id and c.org_id = public.current_org_id()))
  );
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and ((user_id = auth.uid() and coalesce(public.current_user_role(), 'readonly') <> 'readonly') or public.is_org_admin())
  )
  with check (org_id = public.current_org_id());
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and ((user_id = auth.uid() and coalesce(public.current_user_role(), 'readonly') <> 'readonly') or public.is_org_admin())
  );

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());
-- case_alerts: no policies (written by the SECURITY DEFINER trigger only).
