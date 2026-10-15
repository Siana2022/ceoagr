import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { saveBranding } from "@/lib/modules/branding/actions";
import type { OrgBranding } from "@/lib/modules/documents/context";
import { LogoField } from "@/components/branding/LogoField";

export default async function BrandingPage({ searchParams }: PageProps<"/settings/branding">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const sp = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("name, settings").maybeSingle();
  const b = (data?.settings?.branding ?? {}) as OrgBranding;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <h1 className="page-title mt-1">Identidad de la empresa</h1>
        <p className="page-sub">Estos datos aparecen en todos los PDF que generes: logotipo en la cabecera y datos fiscales como variables ({"{{org.tax_id}}"}, {"{{org.address}}"}…).</p>
      </div>

      {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}
      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}

      <form action={saveBranding} className="card grid max-w-3xl gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2"><LogoField current={b.logo_data ?? null} /></div>
        <label className="field sm:col-span-2">Razón social<input name="legal_name" defaultValue={b.legal_name ?? ""} className="input" placeholder={data?.name ?? ""} /></label>
        <label className="field">NIF / CIF<input name="tax_id" defaultValue={b.tax_id ?? ""} className="input" /></label>
        <label className="field">Teléfono<input name="phone" defaultValue={b.phone ?? ""} className="input" /></label>
        <label className="field sm:col-span-2">Dirección<input name="address" defaultValue={b.address ?? ""} className="input" /></label>
        <label className="field">Email<input name="email" type="email" defaultValue={b.email ?? ""} className="input" /></label>
        <label className="field">Web<input name="web" defaultValue={b.web ?? ""} className="input" /></label>
        <label className="field">Color corporativo<input name="color" type="color" defaultValue={b.color ?? "#003366"} className="h-10 w-20 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" /></label>
        <label className="field sm:col-span-2">Pie de página de los documentos<input name="footer_text" defaultValue={b.footer_text ?? ""} maxLength={300} className="input" placeholder="Ej.: AGR Ingeniería, S.L. · B12345678 · Av. del Puerto 10, Valencia" /></label>
        <div className="flex items-center gap-4 sm:col-span-2">
          <button type="submit" className="btn btn-primary">Guardar</button>
          <Link href="/settings/templates" className="link text-sm">Ir a las plantillas</Link>
        </div>
      </form>
    </div>
  );
}
