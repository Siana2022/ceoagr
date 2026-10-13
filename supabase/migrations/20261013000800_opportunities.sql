-- Delivery 3: opportunities (sales funnel) and quotes. Requires 20261013000700_time_tracking.sql.

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  stage text not null default 'lead' check (stage in ('lead', 'study', 'quote_sent', 'negotiation', 'won', 'lost')),
  expected_value numeric(12, 2) check (expected_value is null or expected_value >= 0),
  probability int check (probability is null or probability between 0 and 100),
  owner_id uuid default auth.uid() references auth.users (id) on delete set null,
  expected_close date,
  source text,
  lost_reason text,
  notes text,
  case_id uuid references public.cases (id) on delete set null,
  closed_at timestamptz,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index opportunities_org_id_idx on public.opportunities (org_id);
create index opportunities_contact_idx on public.opportunities (contact_id);
create index opportunities_owner_idx on public.opportunities (owner_id);
create index opportunities_stage_idx on public.opportunities (org_id, stage);

create table public.quote_counters (
  org_id uuid not null references public.organizations (id) on delete cascade,
  year int not null,
  last int not null default 0,
  primary key (org_id, year)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  contact_id uuid not null references public.contacts (id) on delete restrict,
  number text not null default '',
  title text not null check (length(trim(title)) > 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  issue_date date not null default current_date,
  valid_until date,
  notes text,
  tax_rate numeric(5, 2) not null default 21 check (tax_rate between 0 and 100),
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  total_hours numeric(10, 2) not null default 0,
  owner_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, number)
);
create index quotes_org_id_idx on public.quotes (org_id);
create index quotes_opportunity_idx on public.quotes (opportunity_id);
create index quotes_contact_idx on public.quotes (contact_id);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  position int not null default 0,
  description text not null check (length(trim(description)) > 0),
  hours numeric(8, 2) check (hours is null or hours >= 0),
  quantity numeric(10, 2) not null default 1 check (quantity >= 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  amount numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index quote_lines_org_id_idx on public.quote_lines (org_id);
create index quote_lines_quote_idx on public.quote_lines (quote_id, position);

create trigger opportunities_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger opportunities_audit
  after insert or update or delete on public.opportunities
  for each row execute function public.audit_row_change();
create trigger quotes_audit
  after insert or update or delete on public.quotes
  for each row execute function public.audit_row_change();

create function public.opportunities_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage in ('won', 'lost') then
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger opportunities_before_write
  before insert or update on public.opportunities
  for each row execute function public.opportunities_before_write();

create function public.next_quote_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_year int := extract(year from now())::int;
  v_n int;
begin
  if v_org is null then
    raise exception 'no organization';
  end if;
  insert into public.quote_counters (org_id, year, last) values (v_org, v_year, 1)
  on conflict (org_id, year) do update set last = public.quote_counters.last + 1
  returning last into v_n;
  return 'PRES-' || v_year || '-' || lpad(v_n::text, 4, '0');
end;
$$;

-- Totals are always derived from the lines (never trusted from the client).
create function public.quotes_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and coalesce(new.number, '') = '' then
    new.number := public.next_quote_number();
  end if;
  if tg_op = 'UPDATE' then
    new.number := old.number;
    select coalesce(sum(amount), 0), coalesce(sum(coalesce(hours, 0)), 0)
      into new.subtotal, new.total_hours
    from public.quote_lines where quote_id = new.id;
  else
    new.subtotal := 0;
    new.total_hours := 0;
  end if;
  new.total := round(new.subtotal * (1 + new.tax_rate / 100), 2);
  return new;
end;
$$;

create trigger quotes_before_write
  before insert or update on public.quotes
  for each row execute function public.quotes_before_write();

-- Touching the quote re-runs the totals trigger.
create function public.quote_lines_touch_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.quotes set updated_at = now()
  where id = coalesce(new.quote_id, old.quote_id);
  return null;
end;
$$;

create trigger quote_lines_touch_quote
  after insert or update or delete on public.quote_lines
  for each row execute function public.quote_lines_touch_quote();

-- Win an opportunity: create the project with budget hours and fees from the quote.
create function public.convert_opportunity(p_opportunity uuid, p_case_type uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  o public.opportunities;
  q public.quotes;
  v_case uuid;
begin
  select * into o from public.opportunities where id = p_opportunity;
  if not found then
    raise exception 'opportunity not found';
  end if;
  if o.case_id is not null then
    raise exception 'opportunity already converted';
  end if;

  select * into q from public.quotes
  where opportunity_id = o.id and status = 'accepted'
  order by updated_at desc limit 1;

  insert into public.cases (contact_id, case_type_id, title, owner_id, budget_hours, fee_amount)
  values (
    o.contact_id, p_case_type, o.title, o.owner_id,
    case when q.id is not null and q.total_hours > 0 then q.total_hours end,
    coalesce(case when q.id is not null then q.subtotal end, o.expected_value)
  )
  returning id into v_case;

  update public.opportunities set stage = 'won', case_id = v_case where id = o.id;
  return v_case;
end;
$$;

revoke all on function public.next_quote_number() from public, anon;
revoke all on function public.quote_lines_touch_quote() from public, anon;
revoke all on function public.convert_opportunity(uuid, uuid) from public, anon;
grant execute on function public.next_quote_number() to authenticated;
grant execute on function public.convert_opportunity(uuid, uuid) to authenticated;

alter table public.opportunities enable row level security;
alter table public.quote_counters enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;

create policy opportunities_select on public.opportunities
  for select to authenticated
  using (public.can_view_record('opportunity', id, owner_id, org_id));
create policy opportunities_insert on public.opportunities
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and (public.current_user_role() in ('owner', 'admin', 'manager') or owner_id = auth.uid())
    and exists (select 1 from public.contacts c where c.id = opportunities.contact_id and c.org_id = public.current_org_id())
  );
create policy opportunities_update on public.opportunities
  for update to authenticated
  using (public.can_edit_record('opportunity', id, owner_id, org_id))
  with check (org_id = public.current_org_id());
create policy opportunities_delete on public.opportunities
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

create policy quotes_select on public.quotes
  for select to authenticated
  using (public.can_view_record('quote', id, owner_id, org_id));
create policy quotes_insert on public.quotes
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and (public.current_user_role() in ('owner', 'admin', 'manager') or owner_id = auth.uid())
    and exists (select 1 from public.contacts c where c.id = quotes.contact_id and c.org_id = public.current_org_id())
    and (opportunity_id is null or exists (
      select 1 from public.opportunities o where o.id = quotes.opportunity_id and o.org_id = public.current_org_id()))
  );
create policy quotes_update on public.quotes
  for update to authenticated
  using (public.can_edit_record('quote', id, owner_id, org_id))
  with check (org_id = public.current_org_id());
create policy quotes_delete on public.quotes
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

create policy quote_lines_select on public.quote_lines
  for select to authenticated
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_lines.quote_id and public.can_view_record('quote', q.id, q.owner_id, q.org_id)
  ));
create policy quote_lines_insert on public.quote_lines
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.quotes q
      where q.id = quote_lines.quote_id and public.can_edit_record('quote', q.id, q.owner_id, q.org_id)
    )
  );
create policy quote_lines_update on public.quote_lines
  for update to authenticated
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_lines.quote_id and public.can_edit_record('quote', q.id, q.owner_id, q.org_id)
  ))
  with check (org_id = public.current_org_id());
create policy quote_lines_delete on public.quote_lines
  for delete to authenticated
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_lines.quote_id and public.can_edit_record('quote', q.id, q.owner_id, q.org_id)
  ));
-- quote_counters: no policies (SECURITY DEFINER function only).
