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
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="page-title">Tipos de expediente</h1>
          <Link href="/settings/case-types/new" className="btn btn-primary">
            Nuevo tipo
          </Link>
        </div>
      </div>

      <div className="table-card max-w-3xl"><table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Prefijo</th>
            <th>Estados</th>
            <th>Campos</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id}>
              <td>
                <Link href={`/settings/case-types/${t.id}`} className="link">{t.name}</Link>
                {t.archived && <span className="ml-2 text-xs text-muted">(archivado)</span>}
              </td>
              <td>{t.code_prefix}</td>
              <td>{t.pipeline.length}</td>
              <td>{t.custom_schema.length}</td>
              <td className="text-right">
                {t.archived ? (
                  <form action={restoreCaseType.bind(null, t.id)}>
                    <button type="submit" className="link">Restaurar</button>
                  </form>
                ) : (
                  <form action={archiveCaseType.bind(null, t.id)}>
                    <button type="submit" className="link">Archivar</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {types.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-muted">
                Aún no hay tipos. Crea el primero para poder abrir expedientes.
              </td>
            </tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
