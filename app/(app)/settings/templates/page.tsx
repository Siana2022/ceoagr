import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listTemplates } from "@/lib/modules/documents/queries";
import { createStarterTemplates, deleteTemplate, duplicateTemplate, setDefaultTemplate } from "@/lib/modules/documents/actions";
import { CONTEXT_LABELS } from "@/lib/modules/documents/variables";
import { fmtDate } from "@/lib/modules/format";

export default async function TemplatesPage({ searchParams }: PageProps<"/settings/templates">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const [sp, templates] = await Promise.all([searchParams, listTemplates()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Plantillas de documentos</h1>
            <p className="page-sub">Crea tus propios modelos (presupuestos, cartas, informes) y genera PDF con los datos del cliente o del expediente.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/branding" className="btn btn-secondary">Identidad de la empresa</Link>
            <Link href="/settings/templates/new" className="btn btn-primary">Nueva plantilla</Link>
          </div>
        </div>
      </div>

      {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}

      {templates.length === 0 ? (
        <section className="card flex flex-col items-start gap-4 p-8">
          <h2 className="section-title">Aún no tienes plantillas</h2>
          <p className="text-sm text-muted">Empieza con tres modelos de ejemplo (presupuesto, carta al cliente e informe de expediente) y adáptalos a tu gusto, o crea una desde cero.</p>
          <form action={createStarterTemplates}><button type="submit" className="btn btn-primary">Crear plantillas de ejemplo</button></form>
        </section>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/settings/templates/${t.id}`} className="link text-base">{t.name}</Link>
                  {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
                </div>
                {t.is_default && <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Predeterminada</span>}
              </div>
              <p className="text-xs text-muted">{CONTEXT_LABELS[t.context]} · creada el {fmtDate(t.created_at)}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Link href={`/settings/templates/${t.id}`} className="link">Editar</Link>
                <a href={`/settings/templates/${t.id}/preview`} target="_blank" rel="noreferrer" className="link">Vista previa PDF</a>
                <form action={duplicateTemplate.bind(null, t.id)}><button type="submit" className="link">Duplicar</button></form>
                {!t.is_default && <form action={setDefaultTemplate.bind(null, t.id)}><button type="submit" className="link">Hacer predeterminada</button></form>}
                <form action={deleteTemplate.bind(null, t.id)} className="ml-auto"><button type="submit" className="link-danger">Eliminar</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
