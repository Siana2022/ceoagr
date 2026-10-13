-- Phase 1 / Documents: documents, templates and the private storage bucket.
-- Requires 20261013000200_cases.sql.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  version int not null default 1,
  parent_document_id uuid references public.documents (id) on delete set null,
  tags text[] not null default '{}',
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index documents_org_id_idx on public.documents (org_id);
create index documents_case_idx on public.documents (case_id);
create index documents_contact_idx on public.documents (contact_id);
create index documents_parent_idx on public.documents (parent_document_id);
create index documents_tags_idx on public.documents using gin (tags);
create index documents_name_trgm_idx on public.documents using gin (name extensions.gin_trgm_ops);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'html' check (kind in ('html', 'docx')),
  body text not null default '',
  case_type_id uuid references public.case_types (id) on delete set null,
  variables_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index document_templates_org_id_idx on public.document_templates (org_id);
create index document_templates_type_idx on public.document_templates (case_type_id);

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger document_templates_updated_at before update on public.document_templates
  for each row execute function public.set_updated_at();
create trigger documents_audit
  after insert or update or delete on public.documents
  for each row execute function public.audit_row_change();

-- A document is visible when its case or contact is visible, or it is the author's.
create function public.can_view_document(p_case uuid, p_contact uuid, p_created_by uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_org = public.current_org_id() and (
      public.current_user_role() in ('owner', 'admin')
      or p_created_by = auth.uid()
      or exists (select 1 from public.cases c
                 where c.id = p_case and public.can_view_record('case', c.id, c.owner_id, c.org_id))
      or exists (select 1 from public.contacts k
                 where k.id = p_contact and public.can_view_contact(k.id, k.owner_id, k.org_id))
    ), false);
$$;

create function public.can_edit_document(p_case uuid, p_contact uuid, p_created_by uuid, p_org uuid)
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
      or p_created_by = auth.uid()
      or exists (select 1 from public.cases c
                 where c.id = p_case and public.can_edit_record('case', c.id, c.owner_id, c.org_id))
      or exists (select 1 from public.contacts k
                 where k.id = p_contact and public.can_edit_contact(k.id, k.owner_id, k.org_id))
    ), false);
$$;

revoke all on function public.can_view_document(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.can_edit_document(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.can_view_document(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.can_edit_document(uuid, uuid, uuid, uuid) to authenticated;

alter table public.documents enable row level security;
alter table public.document_templates enable row level security;

create policy documents_select on public.documents
  for select to authenticated
  using (public.can_view_document(case_id, contact_id, created_by, org_id));
create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager', 'member')
    and storage_path like 'org/' || public.current_org_id()::text || '/%'
    and (case_id is null or exists (
      select 1 from public.cases c where c.id = documents.case_id and c.org_id = public.current_org_id()))
    and (contact_id is null or exists (
      select 1 from public.contacts k where k.id = documents.contact_id and k.org_id = public.current_org_id()))
  );
create policy documents_update on public.documents
  for update to authenticated
  using (public.can_edit_document(case_id, contact_id, created_by, org_id))
  with check (org_id = public.current_org_id());
create policy documents_delete on public.documents
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

create policy document_templates_select on public.document_templates
  for select to authenticated
  using (org_id = public.current_org_id());
create policy document_templates_insert on public.document_templates
  for insert to authenticated
  with check (org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager'));
create policy document_templates_update on public.document_templates
  for update to authenticated
  using (org_id = public.current_org_id()
    and coalesce(public.current_user_role(), 'readonly') in ('owner', 'admin', 'manager'))
  with check (org_id = public.current_org_id());
create policy document_templates_delete on public.document_templates
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_admin());

-- ---------------------------------------------------------------- storage
-- Private bucket; objects live at org/{org_id}/{entity}/{id}/{file}.

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)
on conflict (id) do nothing;

create policy documents_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'org'
    and (storage.foldername(name))[2] = public.current_org_id()::text
    and coalesce(public.current_user_role(), 'readonly') <> 'readonly'
  );

-- Reading an object requires being able to see its documents row (RLS applies).
create policy documents_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (select 1 from public.documents d where d.storage_path = storage.objects.name)
  );

create policy documents_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = public.current_org_id()::text
    and public.is_org_admin()
  );
