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
        <Link href="/settings" className="text-sm underline">← Ajustes</Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Plantillas de documento</h1>
          <Link href="/settings/templates/new" className="rounded-[5px] bg-brand px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white hover:bg-brand-dark">
            Nueva plantilla
          </Link>
        </div>
      </div>
      <table className="w-full max-w-2xl text-left text-sm">
        <thead className="border-b border-zinc-200">
          <tr><th className="py-2 font-medium">Nombre</th><th className="py-2 font-medium">Creada</th><th className="py-2" /></tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-b border-zinc-100">
              <td className="py-2"><Link href={`/settings/templates/${t.id}`} className="font-medium text-brand underline">{t.name}</Link></td>
              <td className="py-2">{fmtDate(t.created_at)}</td>
              <td className="py-2 text-right">
                <form action={deleteTemplate.bind(null, t.id)}><button type="submit" className="text-red-600 underline">Eliminar</button></form>
              </td>
            </tr>
          ))}
          {templates.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-zinc-500">Aún no hay plantillas.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
