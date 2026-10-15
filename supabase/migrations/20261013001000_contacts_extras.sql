-- Contacts, part B: duplicate merge, saved views, relation hardening, search indexes.

alter table public.contacts add column merged_into uuid references public.contacts (id) on delete set null;
create index contacts_merged_into_idx on public.contacts (merged_into) where merged_into is not null;

-- ------------------------------------------------------------ search indexes
create index tasks_title_trgm_idx on public.tasks using gin (title extensions.gin_trgm_ops);
create index opportunities_title_trgm_idx on public.opportunities using gin (title extensions.gin_trgm_ops);
create index quotes_title_trgm_idx on public.quotes using gin (title extensions.gin_trgm_ops);
create index quotes_number_trgm_idx on public.quotes using gin (number extensions.gin_trgm_ops);
create index contacts_tax_id_trgm_idx on public.contacts using gin (tax_id extensions.gin_trgm_ops);

-- --------------------------------------------------------- relation hardening
alter table public.contact_relations
  add constraint contact_relations_type_len check (length(trim(relation_type)) between 1 and 60);

drop policy contact_relations_insert on public.contact_relations;
create policy contact_relations_insert on public.contact_relations
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.contacts c
      where c.id = contact_relations.contact_id
        and public.can_edit_contact(c.id, c.owner_id, c.org_id)
    )
    and exists (
      select 1 from public.contacts k
      where k.id = contact_relations.related_contact_id and k.org_id = public.current_org_id()
    )
  );

-- --------------------------------------------------------------- merge
-- Moves everything from the duplicates to the primary contact, fills the
-- primary's empty fields, and archives the duplicates (never deletes them).
create function public.merge_contacts(p_primary uuid, p_duplicates uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_primary public.contacts;
  d public.contacts;
  v_dup uuid;
  v_count int := 0;
begin
  if coalesce(public.current_user_role(), 'readonly') not in ('owner', 'admin') then
    raise exception 'forbidden';
  end if;
  if p_duplicates is null or cardinality(p_duplicates) = 0 then
    raise exception 'no duplicates given';
  end if;

  select * into v_primary from public.contacts
  where id = p_primary and org_id = v_org and not archived;
  if not found then
    raise exception 'primary contact not found';
  end if;

  foreach v_dup in array p_duplicates loop
    if v_dup = p_primary then
      continue;
    end if;
    select * into d from public.contacts
    where id = v_dup and org_id = v_org and not archived
    for update;
    if not found then
      raise exception 'duplicate contact not found';
    end if;

    update public.contacts set
      legal_name = coalesce(legal_name, d.legal_name),
      tax_id = coalesce(tax_id, d.tax_id),
      email = coalesce(email, d.email),
      phone = coalesce(phone, d.phone),
      mobile = coalesce(mobile, d.mobile),
      source = coalesce(source, d.source),
      address = case when address = '{}'::jsonb then d.address else address end,
      tags = (select coalesce(array_agg(distinct t), '{}') from unnest(tags || d.tags) t),
      custom_fields = d.custom_fields || custom_fields
    where id = p_primary;

    update public.cases set contact_id = p_primary where contact_id = v_dup;
    update public.tasks set contact_id = p_primary where contact_id = v_dup;
    update public.opportunities set contact_id = p_primary where contact_id = v_dup;
    update public.quotes set contact_id = p_primary where contact_id = v_dup;
    update public.appointments set contact_id = p_primary where contact_id = v_dup;
    update public.documents set contact_id = p_primary where contact_id = v_dup;

    delete from public.case_participants cp
    where cp.contact_id = v_dup
      and exists (select 1 from public.case_participants x where x.case_id = cp.case_id and x.contact_id = p_primary);
    update public.case_participants set contact_id = p_primary where contact_id = v_dup;

    -- Relations between the duplicate and the primary would become self-relations.
    delete from public.contact_relations
    where (contact_id = v_dup and related_contact_id = p_primary)
       or (contact_id = p_primary and related_contact_id = v_dup);
    update public.contact_relations set contact_id = p_primary where contact_id = v_dup;
    update public.contact_relations set related_contact_id = p_primary where related_contact_id = v_dup;
    delete from public.contact_relations a using public.contact_relations b
    where a.contact_id = b.contact_id and a.related_contact_id = b.related_contact_id
      and a.relation_type = b.relation_type and a.id > b.id
      and (a.contact_id = p_primary or a.related_contact_id = p_primary);

    delete from public.record_shares s
    where s.entity = 'contact' and s.entity_id = v_dup
      and exists (select 1 from public.record_shares x
                  where x.entity = 'contact' and x.entity_id = p_primary and x.user_id = s.user_id);
    update public.record_shares set entity_id = p_primary where entity = 'contact' and entity_id = v_dup;

    update public.contacts
    set archived = true, archived_at = now(), merged_into = p_primary
    where id = v_dup;

    insert into public.audit_log (org_id, actor_id, entity, entity_id, action, diff)
    values (v_org, auth.uid(), 'contacts', p_primary, 'merge',
            jsonb_build_object('merged_id', v_dup, 'merged_name', d.name));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.merge_contacts(uuid, uuid[]) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------- saved views
create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity text not null check (entity in ('contacts', 'cases', 'tasks', 'opportunities')),
  name text not null check (length(trim(name)) between 1 and 60),
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity, name)
);
create index saved_views_org_id_idx on public.saved_views (org_id);
create index saved_views_user_idx on public.saved_views (user_id, entity);

create trigger saved_views_updated_at before update on public.saved_views
  for each row execute function public.set_updated_at();

alter table public.saved_views enable row level security;

create policy saved_views_select on public.saved_views
  for select to authenticated
  using (org_id = public.current_org_id() and (user_id = auth.uid() or is_shared));
create policy saved_views_insert on public.saved_views
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and user_id = auth.uid()
    and coalesce(public.current_user_role(), 'readonly') <> 'readonly'
    and (not is_shared or public.current_user_role() in ('owner', 'admin', 'manager'))
  );
create policy saved_views_update on public.saved_views
  for update to authenticated
  using (org_id = public.current_org_id() and (user_id = auth.uid() or public.is_org_admin()))
  with check (org_id = public.current_org_id());
create policy saved_views_delete on public.saved_views
  for delete to authenticated
  using (org_id = public.current_org_id() and (user_id = auth.uid() or public.is_org_admin()));
