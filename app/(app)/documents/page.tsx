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
      <h1 className="text-xl font-semibold">{archived ? "Documentos archivados" : "Documentos"}</h1>

      <form method="get" role="search" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Nombre del archivo" className={`${inputClass} h-10 w-64`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Etiqueta
          <input name="tag" autoComplete="off" defaultValue={tag} className={`${inputClass} h-10 w-40`} />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} />
          Ver archivados
        </label>
        <button type="submit" className="h-10 rounded-[5px] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand hover:text-white">Filtrar</button>
      </form>

      {error && <p role="alert" className="text-sm text-red-600">No se pudieron cargar los documentos.</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200">
            <tr>
              <th className="py-2 pr-4 font-medium">Nombre</th>
              <th className="py-2 pr-4 font-medium">Versión</th>
              <th className="py-2 pr-4 font-medium">Expediente / Contacto</th>
              <th className="py-2 pr-4 font-medium">Etiquetas</th>
              <th className="py-2 pr-4 font-medium">Tamaño</th>
              <th className="py-2 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-zinc-100">
                <td className="py-2 pr-4"><Link href={`/documents/${d.id}`} className="font-medium text-brand underline">{d.name}</Link></td>
                <td className="py-2 pr-4">v{d.version}</td>
                <td className="py-2 pr-4">
                  {d.case_id && d.cases ? <Link href={`/cases/${d.case_id}`} className="underline">{d.cases.code}</Link>
                    : d.contact_id && d.contacts ? <Link href={`/contacts/${d.contact_id}`} className="underline">{d.contacts.name}</Link> : "—"}
                </td>
                <td className="py-2 pr-4">{d.tags.join(", ") || "—"}</td>
                <td className="py-2 pr-4">{formatBytes(d.size_bytes)}</td>
                <td className="py-2">{fmtDate(d.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr><td colSpan={6} className="py-8 text-center text-zinc-500">{q || tag ? "Ningún documento coincide con los filtros." : "Aún no hay documentos."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>{total} documento{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-3">
          {current > 1 ? <Link href={href({ page: String(current - 1) })} className="underline">Anterior</Link> : <span className="text-zinc-400">Anterior</span>}
          <span>Página {current} de {pages}</span>
          {current < pages ? <Link href={href({ page: String(current + 1) })} className="underline">Siguiente</Link> : <span className="text-zinc-400">Siguiente</span>}
        </div>
      </div>

      {writable && (
        <section className="flex flex-col gap-2 border-t border-zinc-200 pt-4">
          <h2 className="text-lg font-semibold">Subir documento</h2>
          <p className="text-sm text-zinc-500">Para vincularlo a un expediente o contacto, súbelo desde su ficha.</p>
          <UploadForm action={uploadDocument} />
        </section>
      )}
    </div>
  );
}
