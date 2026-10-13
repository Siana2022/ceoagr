import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { archiveCaseType, restoreCaseType } from "@/lib/modules/cases/actions";

export default async function CaseTypesPage() {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const types = await listCaseTypes(true);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm underline">← Ajustes</Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Tipos de expediente</h1>
          <Link href="/settings/case-types/new" className="rounded-[5px] bg-brand px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white hover:bg-brand-dark">
            Nuevo tipo
          </Link>
        </div>
      </div>

      <table className="w-full max-w-3xl text-left text-sm">
        <thead className="border-b border-zinc-200">
          <tr>
            <th className="py-2 font-medium">Nombre</th>
            <th className="py-2 font-medium">Prefijo</th>
            <th className="py-2 font-medium">Estados</th>
            <th className="py-2 font-medium">Campos</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id} className="border-b border-zinc-100">
              <td className="py-2">
                <Link href={`/settings/case-types/${t.id}`} className="font-medium text-brand underline">{t.name}</Link>
                {t.archived && <span className="ml-2 text-xs text-zinc-500">(archivado)</span>}
              </td>
              <td className="py-2">{t.code_prefix}</td>
              <td className="py-2">{t.pipeline.length}</td>
              <td className="py-2">{t.custom_schema.length}</td>
              <td className="py-2 text-right">
                {t.archived ? (
                  <form action={restoreCaseType.bind(null, t.id)}>
                    <button type="submit" className="underline">Restaurar</button>
                  </form>
                ) : (
                  <form action={archiveCaseType.bind(null, t.id)}>
                    <button type="submit" className="underline">Archivar</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {types.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-zinc-500">
                Aún no hay tipos. Crea el primero para poder abrir expedientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
