import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listContacts, PAGE_SIZE, type ContactFilters } from "@/lib/modules/contacts/queries";
import { CONTACT_KIND_LABELS, type ContactKind } from "@/lib/modules/contacts/types";
import { inputClass } from "@/components/form-styles";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const sp = await searchParams;
  const q = first(sp.q) ?? "";
  const kindParam = first(sp.kind);
  const kind = kindParam === "person" || kindParam === "company" ? kindParam : undefined;
  const tag = first(sp.tag) ?? "";
  const archived = first(sp.archived) === "1";
  const sort = first(sp.sort) === "created_at" ? "created_at" : "name";
  const dir = first(sp.dir) === "desc" ? "desc" : "asc";
  const page = Number.parseInt(first(sp.page) ?? "1", 10) || 1;

  const filters: ContactFilters = { q, kind, tag, archived, sort, dir, page };
  const [role, { rows, total, owners, error, page: current }] = await Promise.all([
    getCurrentRole(),
    listContacts(filters),
  ]);

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q, kind, tag, archived: archived ? "1" : undefined, sort, dir, page: String(current), ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/contacts?${p.toString()}`;
  };
  const sortHref = (col: "name" | "created_at") =>
    href({ sort: col, dir: sort === col && dir === "asc" ? "desc" : "asc", page: "1" });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{archived ? "Contactos archivados" : "Contactos"}</h1>
        {role && canWrite(role) && (
          <Link href="/contacts/new" className="btn btn-primary">
            Nuevo contacto
          </Link>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <label className="field">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Nombre, email, NIF, teléfono" className={`${inputClass} h-10 w-80`} />
        </label>
        <label className="field">
          Tipo
          <select name="kind" defaultValue={kind ?? ""} className={`${inputClass} h-10`}>
            <option value="">Todos</option>
            <option value="person">Personas</option>
            <option value="company">Empresas</option>
          </select>
        </label>
        <label className="field">
          Etiqueta
          <input name="tag" autoComplete="off" defaultValue={tag} className={`${inputClass} h-10 w-40`} />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} />
          Ver archivados
        </label>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>

      {error && <p role="alert" className="alert-error">No se pudieron cargar los contactos.</p>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>
                <Link href={sortHref("name")}>Nombre{sort === "name" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link>
              </th>
              <th>Tipo</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Etiquetas</th>
              <th>Responsable</th>
              <th>
                <Link href={sortHref("created_at")}>Alta{sort === "created_at" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/contacts/${c.id}`} className="link">{c.name}</Link>
                </td>
                <td>{CONTACT_KIND_LABELS[c.kind as ContactKind]}</td>
                <td>{c.email ?? "—"}</td>
                <td>{c.phone ?? "—"}</td>
                <td>{c.tags.join(", ") || "—"}</td>
                <td>{(c.owner_id && owners.get(c.owner_id)) || "—"}</td>
                <td>{new Date(c.created_at).toLocaleDateString("es-ES")}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
                  {q || kind || tag ? "Ningún contacto coincide con los filtros." : archived ? "No hay contactos archivados." : "Aún no hay contactos. Crea el primero con «Nuevo contacto»."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>{total} contacto{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-3">
          {current > 1 ? <Link href={href({ page: String(current - 1) })} className="link">Anterior</Link> : <span className="text-slate-400">Anterior</span>}
          <span>Página {current} de {pages}</span>
          {current < pages ? <Link href={href({ page: String(current + 1) })} className="link">Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
        </div>
      </div>
    </div>
  );
}
