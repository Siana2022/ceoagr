import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type AppRole } from "@/lib/modules/nav";
import { CONFIGURABLE_FIELDS, FIELD_LABELS } from "@/lib/modules/contacts/schema";
import { getRequiredFields } from "@/lib/modules/contacts/queries";
import { saveRequiredFields } from "@/lib/modules/contacts/actions";
import { buttonClass } from "@/components/form-styles";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("current_user_role");
  if (!role || !isStaffRole(role as AppRole)) redirect("/");

  const required = await getRequiredFields();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Ajustes</h1>

      <nav aria-label="Secciones de ajustes" className="flex flex-wrap gap-2 text-sm">
        {(role === "owner" || role === "admin") && (
          <Link href="/settings/team" className="btn btn-secondary btn-sm">Equipo y usuarios</Link>
        )}
        {(role === "owner" || role === "admin") && (
          <Link href="/settings/case-types" className="btn btn-secondary btn-sm">Tipos de expediente</Link>
        )}
        <Link href="/settings/resources" className="btn btn-secondary btn-sm">Recursos de agenda</Link>
        <Link href="/settings/templates" className="btn btn-secondary btn-sm">Plantillas de documento</Link>
      </nav>

      {role === "owner" || role === "admin" ? (
        <section className="card flex max-w-2xl flex-col gap-2 p-6">
          <h2 className="section-title">Equipo</h2>
          <Link href="/settings/team" className="link text-sm">Crear usuarios, cambiar roles y restablecer contraseñas</Link>
        </section>
      ) : null}

      {role === "owner" || role === "admin" ? (
        <section className="card flex max-w-2xl flex-col gap-2 p-6">
          <h2 className="section-title">Expedientes</h2>
          <Link href="/settings/case-types" className="link text-sm">Configurar tipos de expediente (estados y campos)</Link>
        </section>
      ) : null}

      <section className="card flex max-w-2xl flex-col gap-2 p-6">
        <h2 className="section-title">Documentos</h2>
        <Link href="/settings/templates" className="link text-sm">Gestionar plantillas de documento</Link>
      </section>

      <section className="card flex max-w-2xl flex-col gap-2 p-6">
        <h2 className="section-title">Agenda</h2>
        <Link href="/settings/resources" className="link text-sm">Gestionar recursos (profesionales, salas, equipos)</Link>
      </section>

      <section className="card flex max-w-2xl flex-col gap-3 p-6">
        <h2 className="section-title">Contactos: campos obligatorios</h2>
        <p className="text-sm text-muted">El nombre y el tipo son siempre obligatorios. Marca qué otros campos deben rellenarse.</p>
        {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}
        {sp.error && <p role="alert" className="alert-error">No se pudieron guardar los cambios.</p>}
        <form action={saveRequiredFields} className="flex flex-col gap-2">
          {CONFIGURABLE_FIELDS.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="required" value={f} defaultChecked={required.includes(f)} />
              {FIELD_LABELS[f]}
            </label>
          ))}
          <div className="mt-2 w-40">
            <button type="submit" className={buttonClass}>Guardar</button>
          </div>
        </form>
      </section>

    </div>
  );
}
