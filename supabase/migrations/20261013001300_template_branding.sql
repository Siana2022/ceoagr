-- Document templates: context, description, page settings, default flag; company branding.

alter table public.document_templates
  add column context text not null default 'general' check (context in ('general', 'contact', 'case', 'quote')),
  add column description text,
  add column page_settings jsonb not null default '{}'::jsonb,
  add column is_default boolean not null default false;

-- At most one default template per organization and context.
create unique index document_templates_default_idx
  on public.document_templates (org_id, context) where is_default;

-- Company identity used in every generated document (logo is a small embedded PNG/JPEG).
create function public.set_org_branding(p_branding jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current jsonb;
  v_logo jsonb;
begin
  if coalesce(public.current_user_role(), 'readonly') not in ('owner', 'admin') then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_branding) is distinct from 'object' then
    raise exception 'invalid branding';
  end if;
  if p_branding ->> 'color' is not null and p_branding ->> 'color' !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'invalid color';
  end if;
  if p_branding ? 'logo_data' and jsonb_typeof(p_branding -> 'logo_data') = 'string'
     and (p_branding ->> 'logo_data' !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$'
          or length(p_branding ->> 'logo_data') > 700000) then
    raise exception 'invalid logo';
  end if;

  select coalesce(settings -> 'branding', '{}'::jsonb) into v_current
  from public.organizations where id = public.current_org_id();

  -- Keep the stored logo unless the caller sends the key (null removes it).
  v_logo := case when p_branding ? 'logo_data' then p_branding -> 'logo_data' else v_current -> 'logo_data' end;

  update public.organizations
  set settings = jsonb_set(
    coalesce(settings, '{}'::jsonb), '{branding}',
    jsonb_strip_nulls(jsonb_build_object(
      'legal_name', left(coalesce(p_branding ->> 'legal_name', v_current ->> 'legal_name', ''), 200),
      'tax_id', left(coalesce(p_branding ->> 'tax_id', v_current ->> 'tax_id', ''), 40),
      'address', left(coalesce(p_branding ->> 'address', v_current ->> 'address', ''), 300),
      'phone', left(coalesce(p_branding ->> 'phone', v_current ->> 'phone', ''), 40),
      'email', left(coalesce(p_branding ->> 'email', v_current ->> 'email', ''), 120),
      'web', left(coalesce(p_branding ->> 'web', v_current ->> 'web', ''), 120),
      'color', coalesce(p_branding ->> 'color', v_current ->> 'color', '#003366'),
      'footer_text', left(coalesce(p_branding ->> 'footer_text', v_current ->> 'footer_text', ''), 300),
      'logo_data', v_logo
    )), true)
  where id = public.current_org_id();
end;
$$;

revoke all on function public.set_org_branding(jsonb) from public, anon;
grant execute on function public.set_org_branding(jsonb) to authenticated;
