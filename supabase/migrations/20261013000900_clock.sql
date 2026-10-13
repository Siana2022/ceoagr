-- Delivery 4: working-time register (control horario). Append-only by design.

create table public.clock_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('in', 'out', 'pause_start', 'pause_end')),
  at timestamptz not null default now(),
  source text not null default 'web' check (source in ('web', 'mobile', 'manual')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (source <> 'manual' or length(trim(coalesce(note, ''))) >= 3)
);
create index clock_events_org_id_idx on public.clock_events (org_id);
create index clock_events_user_at_idx on public.clock_events (user_id, at desc);

-- Events are never edited or deleted; corrections are new "manual" events with a reason.
create function public.clock_events_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'clock events are immutable';
end;
$$;

create trigger clock_events_immutable
  before update or delete on public.clock_events
  for each row execute function public.clock_events_immutable();

-- Server time is authoritative; the sequence must be consistent.
create function public.clock_events_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_last text;
begin
  if new.source = 'manual' then
    if new.at > now() then
      raise exception 'manual event cannot be in the future';
    end if;
    return new;
  end if;

  new.at := now();
  select kind into v_last from public.clock_events
  where user_id = new.user_id order by at desc, created_at desc limit 1;

  v_last := coalesce(v_last, 'none');
  if not (
    (new.kind = 'in' and v_last in ('none', 'out'))
    or (new.kind = 'out' and v_last in ('in', 'pause_end', 'pause_start'))
    or (new.kind = 'pause_start' and v_last in ('in', 'pause_end'))
    or (new.kind = 'pause_end' and v_last = 'pause_start')
  ) then
    raise exception 'invalid clock sequence: % after %', new.kind, v_last;
  end if;
  return new;
end;
$$;

create trigger clock_events_before_insert
  before insert on public.clock_events
  for each row execute function public.clock_events_before_insert();
create trigger clock_events_audit
  after insert on public.clock_events
  for each row execute function public.audit_row_change();

alter table public.clock_events enable row level security;

create policy clock_events_select on public.clock_events
  for select to authenticated
  using (
    org_id = public.current_org_id() and (
      user_id = auth.uid()
      or public.current_user_role() in ('owner', 'admin')
      or (public.current_user_role() = 'manager' and public.same_team_as(user_id))
    )
  );

-- Everybody clocks themselves; only admins add manual corrections for others.
create policy clock_events_insert on public.clock_events
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() is not null
    and (
      (user_id = auth.uid() and source in ('web', 'mobile'))
      or (public.is_org_admin() and source = 'manual'
          and exists (select 1 from public.memberships m where m.user_id = clock_events.user_id and m.org_id = public.current_org_id()))
    )
  );
