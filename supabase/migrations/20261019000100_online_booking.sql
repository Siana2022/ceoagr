-- Online booking (spec 5.12): a public page per resource, backed by
-- availability_rules/exceptions. No direct table access is ever granted to
-- the `anon` role: the public pages only call the three SECURITY DEFINER
-- functions at the bottom, each doing its own validation and rate limiting.
-- Requires 20261013000400_agenda.sql.

alter table public.resources
  add column public_booking boolean not null default false,
  add column slot_minutes int not null default 60 check (slot_minutes between 5 and 480);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday … 6 = Saturday
  start_time time not null,
  end_time time not null,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (end_time > start_time),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index availability_rules_org_id_idx on public.availability_rules (org_id);
create index availability_rules_resource_idx on public.availability_rules (resource_id, weekday);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (resource_id, date)
);
create index availability_exceptions_org_id_idx on public.availability_exceptions (org_id);

-- Every public attempt is logged (successful or not) for throttling and to
-- spot abuse; nobody can read it through the API except admins.
create table public.public_booking_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  resource_id uuid references public.resources (id) on delete set null,
  ip text,
  email text,
  success boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
create index public_booking_attempts_ip_idx on public.public_booking_attempts (ip, created_at desc);
create index public_booking_attempts_org_idx on public.public_booking_attempts (org_id, created_at desc);

-- -------------------------------------------------------------------- RLS

alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.public_booking_attempts enable row level security;

create policy availability_rules_select on public.availability_rules
  for select to authenticated using (org_id = public.current_org_id());
create policy availability_rules_insert on public.availability_rules
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager')
    and exists (select 1 from public.resources r where r.id = availability_rules.resource_id and r.org_id = public.current_org_id())
  );
create policy availability_rules_update on public.availability_rules
  for update to authenticated
  using (org_id = public.current_org_id() and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager'))
  with check (org_id = public.current_org_id());
create policy availability_rules_delete on public.availability_rules
  for delete to authenticated
  using (org_id = public.current_org_id() and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager'));

create policy availability_exceptions_select on public.availability_exceptions
  for select to authenticated using (org_id = public.current_org_id());
create policy availability_exceptions_insert on public.availability_exceptions
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager')
    and exists (select 1 from public.resources r where r.id = availability_exceptions.resource_id and r.org_id = public.current_org_id())
  );
create policy availability_exceptions_delete on public.availability_exceptions
  for delete to authenticated
  using (org_id = public.current_org_id() and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager'));

-- Staff can review attempts (to spot spam); nothing is ever exposed to anon.
create policy public_booking_attempts_select on public.public_booking_attempts
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

-- -------------------------------------------------------- public (anon) API
-- These three functions are the ONLY objects granted to `anon` in the whole
-- schema. Each re-validates everything server-side; none trusts its input.

-- Org name/branding + the resources open for public booking. No other data.
create function public.public_org_booking_info(p_org_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org record;
  v_resources jsonb;
begin
  select id, name, settings into v_org from public.organizations where slug = p_org_slug;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'name', r.name, 'kind', r.kind, 'color', r.color, 'slot_minutes', r.slot_minutes
  ) order by r.name), '[]'::jsonb)
  into v_resources
  from public.resources r
  where r.org_id = v_org.id and r.public_booking and r.active;

  return jsonb_build_object(
    'org_name', v_org.name,
    'org_color', coalesce(v_org.settings -> 'branding' ->> 'color', '#003366'),
    'org_logo', v_org.settings -> 'branding' ->> 'logo_data',
    'resources', v_resources
  );
end;
$$;

-- Free slots for one resource on one day, within the next 60 days.
create function public.public_list_slots(p_org_slug text, p_resource_id uuid, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_resource record;
  v_weekday int := extract(dow from p_date)::int;
  v_rule record;
  v_slot_start timestamp;
  v_slot_end timestamp;
  v_blocked boolean;
  v_slots jsonb := '[]'::jsonb;
begin
  if p_date < current_date or p_date > current_date + 60 then
    return '[]'::jsonb;
  end if;

  select id into v_org_id from public.organizations where slug = p_org_slug;
  if v_org_id is null then
    return '[]'::jsonb;
  end if;

  select * into v_resource from public.resources
  where id = p_resource_id and org_id = v_org_id and public_booking and active;
  if not found then
    return '[]'::jsonb;
  end if;

  if exists (select 1 from public.availability_exceptions e where e.resource_id = p_resource_id and e.date = p_date) then
    return '[]'::jsonb;
  end if;

  for v_rule in
    select * from public.availability_rules
    where resource_id = p_resource_id and weekday = v_weekday
      and (valid_from is null or valid_from <= p_date)
      and (valid_to is null or valid_to >= p_date)
  loop
    v_slot_start := p_date + v_rule.start_time;
    while v_slot_start + make_interval(mins => v_resource.slot_minutes) <= p_date + v_rule.end_time loop
      v_slot_end := v_slot_start + make_interval(mins => v_resource.slot_minutes);

      if v_slot_start > (now() at time zone 'Europe/Madrid') then
        select exists (
          select 1 from public.appointments a
          where a.resource_id = p_resource_id
            and a.status <> 'cancelled'
            and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_slot_start at time zone 'Europe/Madrid', v_slot_end at time zone 'Europe/Madrid', '[)')
        ) into v_blocked;
        if not v_blocked then
          v_slots := v_slots || to_jsonb(to_char(v_slot_start, 'HH24:MI'));
        end if;
      end if;
      v_slot_start := v_slot_end;
    end loop;
  end loop;

  return v_slots;
end;
$$;

-- Books a slot: re-validates everything, is rate-limited by IP, and never
-- raises a raw error to the caller (always returns a jsonb {ok, message}).
create function public.public_book_appointment(
  p_org_slug text, p_resource_id uuid, p_date date, p_start_time text,
  p_name text, p_email text, p_phone text, p_notes text,
  p_ip text, p_honeypot text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_resource record;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_contact_id uuid;
  v_recent_attempts int;
  v_blocked boolean;
begin
  -- A filled honeypot means a bot; pretend success without doing anything.
  if coalesce(trim(p_honeypot), '') <> '' then
    insert into public.public_booking_attempts (org_id, resource_id, ip, email, success, reason)
    values (null, p_resource_id, p_ip, p_email, false, 'honeypot');
    return jsonb_build_object('ok', true, 'message', 'Reserva registrada.');
  end if;

  select id into v_org_id from public.organizations where slug = p_org_slug;
  if v_org_id is null then
    return jsonb_build_object('ok', false, 'message', 'No se encuentra la página de reservas.');
  end if;

  select count(*) into v_recent_attempts
  from public.public_booking_attempts
  where ip = p_ip and created_at > now() - interval '1 hour';
  if v_recent_attempts >= 8 then
    insert into public.public_booking_attempts (org_id, resource_id, ip, email, success, reason)
    values (v_org_id, p_resource_id, p_ip, p_email, false, 'rate_limited');
    return jsonb_build_object('ok', false, 'message', 'Demasiados intentos. Inténtalo de nuevo más tarde.');
  end if;

  if coalesce(trim(p_name), '') = '' or length(p_name) > 200 then
    return jsonb_build_object('ok', false, 'message', 'Indica tu nombre.');
  end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then
    return jsonb_build_object('ok', false, 'message', 'Indica un email válido.');
  end if;
  if p_date < current_date or p_date > current_date + 60 or p_start_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    return jsonb_build_object('ok', false, 'message', 'Fecha u hora no válidas.');
  end if;

  select * into v_resource from public.resources
  where id = p_resource_id and org_id = v_org_id and public_booking and active;
  if not found then
    insert into public.public_booking_attempts (org_id, resource_id, ip, email, success, reason)
    values (v_org_id, p_resource_id, p_ip, p_email, false, 'unknown_resource');
    return jsonb_build_object('ok', false, 'message', 'Ese recurso no admite reservas.');
  end if;

  if exists (select 1 from public.availability_exceptions e where e.resource_id = p_resource_id and e.date = p_date) then
    return jsonb_build_object('ok', false, 'message', 'Ese día no está disponible.');
  end if;

  v_starts_at := (p_date + p_start_time::time) at time zone 'Europe/Madrid';
  v_ends_at := v_starts_at + make_interval(mins => v_resource.slot_minutes);
  if v_starts_at <= now() then
    return jsonb_build_object('ok', false, 'message', 'Ese horario ya ha pasado.');
  end if;

  select exists (
    select 1 from public.appointments a
    where a.resource_id = p_resource_id and a.status <> 'cancelled'
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
  ) into v_blocked;
  if v_blocked then
    insert into public.public_booking_attempts (org_id, resource_id, ip, email, success, reason)
    values (v_org_id, p_resource_id, p_ip, p_email, false, 'slot_taken');
    return jsonb_build_object('ok', false, 'message', 'Ese horario ya no está disponible. Elige otro.');
  end if;

  select id into v_contact_id from public.contacts
  where org_id = v_org_id and not archived and lower(email) = lower(trim(p_email))
  limit 1;
  if v_contact_id is null then
    insert into public.contacts (org_id, kind, name, email, phone, source)
    values (v_org_id, 'person', trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), 'Reserva online')
    returning id into v_contact_id;
  end if;

  insert into public.appointments (org_id, resource_id, contact_id, starts_at, ends_at, status, title, notes, source)
  values (
    v_org_id, p_resource_id, v_contact_id, v_starts_at, v_ends_at, 'pending',
    v_resource.name || ' · ' || trim(p_name), nullif(trim(p_notes), ''), 'online'
  );

  insert into public.public_booking_attempts (org_id, resource_id, ip, email, success)
  values (v_org_id, p_resource_id, p_ip, p_email, true);

  return jsonb_build_object(
    'ok', true,
    'message', 'Reserva registrada. Te confirmaremos la cita en breve.',
    'resource_name', v_resource.name
  );
exception when others then
  insert into public.public_booking_attempts (org_id, resource_id, ip, email, success, reason)
  values (v_org_id, p_resource_id, p_ip, p_email, false, 'exclusion_or_error');
  return jsonb_build_object('ok', false, 'message', 'Ese horario ya no está disponible. Elige otro.');
end;
$$;

revoke all on function public.public_org_booking_info(text) from public;
revoke all on function public.public_list_slots(text, uuid, date) from public;
revoke all on function public.public_book_appointment(text, uuid, date, text, text, text, text, text, text, text) from public;
grant execute on function public.public_org_booking_info(text) to anon, authenticated;
grant execute on function public.public_list_slots(text, uuid, date) to anon, authenticated;
grant execute on function public.public_book_appointment(text, uuid, date, text, text, text, text, text, text, text) to anon, authenticated;
