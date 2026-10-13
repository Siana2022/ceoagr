import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listTemplates } from "@/lib/modules/documents/queries";
import { deleteTemplate } from "@/lib/modules/documents/actions";
import { fmtDate } from "@/lib/modules/format";

export default async function TemplatesPage() {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const templates = await listTemplates();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="page-title">Plantillas de documento</h1>
          <Link href="/settings/templates/new" className="btn btn-primary">
            Nueva plantilla
          </Link>
        </div>
      </div>
      <div className="table-card max-w-3xl"><table>
        <thead>
          <tr><th>Nombre</th><th>Creada</th><th /></tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td><Link href={`/settings/templates/${t.id}`} className="link">{t.name}</Link></td>
              <td>{fmtDate(t.created_at)}</td>
              <td className="text-right">
                <form action={deleteTemplate.bind(null, t.id)}><button type="submit" className="link-danger">Eliminar</button></form>
              </td>
            </tr>
          ))}
          {templates.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted">Aún no hay plantillas.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
