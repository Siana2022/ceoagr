import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { DOCS_PAGE_SIZE, listDocuments } from "@/lib/modules/documents/queries";
import { uploadDocument } from "@/lib/modules/documents/actions";
import { formatBytes } from "@/lib/modules/documents/types";
import { fmtDate } from "@/lib/modules/format";
import { UploadForm } from "@/components/documents/UploadForm";
import { inputClass } from "@/components/form-styles";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const sp = await searchParams;
  const q = first(sp.q) ?? "";
  const tag = first(sp.tag) ?? "";
  const archived = first(sp.archived) === "1";
  const page = Number.parseInt(first(sp.page) ?? "1", 10) || 1;

  const [role, { rows, total, error, page: current }] = await Promise.all([
    getCurrentRole(),
    listDocuments({ q, tag, archived, page }),
  ]);
  const writable = !!role && canWrite(role);

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { q, tag, archived: archived ? "1" : undefined, page: String(current), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/documents?${p.toString()}`;
  };
  const pages = Math.max(1, Math.ceil(total / DOCS_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="page-title">{archived ? "Documentos archivados" : "Documentos"}</h1>

      <form method="get" role="search" className="card toolbar">
        <label className="field">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Nombre del archivo" className={`${inputClass} h-10 w-64`} />
        </label>
        <label className="field">
          Etiqueta
          <input name="tag" autoComplete="off" defaultValue={tag} className={`${inputClass} h-10 w-40`} />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} />
          Ver archivados
        </label>
        <button type="submit" className="btn btn-secondary">Filtrar</button>
      </form>

      {error && <p role="alert" className="alert-error">No se pudieron cargar los documentos.</p>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Versión</th>
              <th>Expediente / Contacto</th>
              <th>Etiquetas</th>
              <th>Tamaño</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td><Link href={`/documents/${d.id}`} className="link">{d.name}</Link></td>
                <td>v{d.version}</td>
                <td>
                  {d.case_id && d.cases ? <Link href={`/cases/${d.case_id}`} className="link">{d.cases.code}</Link>
                    : d.contact_id && d.contacts ? <Link href={`/contacts/${d.contact_id}`} className="link">{d.contacts.name}</Link> : "—"}
                </td>
                <td>{d.tags.join(", ") || "—"}</td>
                <td>{formatBytes(d.size_bytes)}</td>
                <td>{fmtDate(d.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr><td colSpan={6} className="py-8 text-center text-muted">{q || tag ? "Ningún documento coincide con los filtros." : "Aún no hay documentos."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>{total} documento{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-3">
          {current > 1 ? <Link href={href({ page: String(current - 1) })} className="link">Anterior</Link> : <span className="text-slate-400">Anterior</span>}
          <span>Página {current} de {pages}</span>
          {current < pages ? <Link href={href({ page: String(current + 1) })} className="link">Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
        </div>
      </div>

      {writable && (
        <section className="card flex flex-col gap-2 p-6">
          <h2 className="section-title">Subir documento</h2>
          <p className="text-sm text-muted">Para vincularlo a un expediente o contacto, súbelo desde su ficha.</p>
          <UploadForm action={uploadDocument} />
        </section>
      )}
    </div>
  );
}
