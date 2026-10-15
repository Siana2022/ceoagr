import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { listDuplicateCandidates } from "@/lib/modules/contacts/queries";
import { mergeContactsAction } from "@/lib/modules/contacts/actions";
import { completeness, findDuplicateGroups, type DupReason } from "@/lib/modules/contacts/dedupe";
import { fmtDate } from "@/lib/modules/format";

const REASON: Record<DupReason, string> = { email: "mismo email", phone: "mismo teléfono", tax_id: "mismo NIF/CIF" };

export default async function DuplicatesPage({ searchParams }: PageProps<"/contacts/duplicates">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/contacts");
  const canMerge = isAdminRole(role);
  const sp = await searchParams;
  const groups = findDuplicateGroups(await listDuplicateCandidates());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/contacts" className="link text-sm">← Contactos</Link>
        <h1 className="page-title mt-1">Posibles duplicados</h1>
        <p className="page-sub">
          Contactos que comparten email, teléfono o NIF/CIF. Al fusionar, expedientes, tareas, citas, documentos y relaciones pasan al contacto principal;
          los demás quedan archivados (no se borran) y los campos vacíos del principal se completan.
        </p>
      </div>

      {sp.merged && <p role="status" className="alert-ok">Fusión completada: {String(sp.merged)} contacto(s) fusionado(s).</p>}
      {sp.error && <p role="alert" className="alert-error">No se pudo fusionar. Elige un principal y al menos un duplicado.</p>}
      {!canMerge && <p className="alert-error">Solo propietarios y administradores pueden fusionar contactos.</p>}

      {groups.length === 0 && <p className="card p-8 text-center text-sm text-muted">No se han encontrado duplicados. 🎉</p>}

      {groups.map((g, i) => {
        const suggested = [...g.contacts].sort((a, b) => completeness(b) - completeness(a) || a.created_at.localeCompare(b.created_at))[0];
        return (
          <form key={g.contacts[0].id} action={mergeContactsAction} className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Grupo {i + 1} · {g.contacts.length} contactos</h2>
              <p className="text-xs text-muted">Coinciden por: {g.reasons.map((r) => REASON[r]).join(", ")}</p>
            </div>
            <div className="table-card !shadow-none">
              <table>
                <thead><tr><th>Principal</th><th>Fusionar</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>NIF/CIF</th><th>Alta</th></tr></thead>
                <tbody>
                  {g.contacts.map((c) => (
                    <tr key={c.id}>
                      <td><input type="radio" name="primary" value={c.id} defaultChecked={c.id === suggested.id} aria-label={`Principal: ${c.name}`} /></td>
                      <td><input type="checkbox" name="merge" value={c.id} defaultChecked={c.id !== suggested.id} aria-label={`Fusionar ${c.name}`} /></td>
                      <td><Link href={`/contacts/${c.id}`} className="link" target="_blank">{c.name}</Link></td>
                      <td>{c.email ?? "—"}</td><td>{c.phone ?? c.mobile ?? "—"}</td><td>{c.tax_id ?? "—"}</td>
                      <td>{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canMerge && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="btn btn-primary">Fusionar seleccionados en el principal</button>
                <p className="text-xs text-muted">Se sugiere como principal el contacto más completo. Esta acción no se puede deshacer desde la app.</p>
              </div>
            )}
          </form>
        );
      })}
    </div>
  );
}
