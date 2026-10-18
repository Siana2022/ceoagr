import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { listContacts, PAGE_SIZE, type ContactFilters } from "@/lib/modules/contacts/queries";
import { CONTACT_KIND_LABELS, type ContactKind } from "@/lib/modules/contacts/types";
import { listViews } from "@/lib/modules/views/queries";
import { SavedViewsBar, SaveViewForm, ViewMessages } from "@/components/views/SavedViews";
import { getUserId } from "@/lib/modules/tasks/queries";
import { fmtDate } from "@/lib/modules/format";
import { inputClass } from "@/components/form-styles";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const COLUMNS = [
  { key: "kind", label: "Tipo" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Teléfono" },
  { key: "tags", label: "Etiquetas" },
  { key: "owner", label: "Responsable" },
  { key: "created", label: "Alta" },
] as const;
type ColKey = (typeof COLUMNS)[number]["key"];

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
  const rawCols = (Array.isArray(sp.cols) ? sp.cols : sp.cols ? [sp.cols] : []) as string[];
  const cols = COLUMNS.map((c) => c.key).filter((k) => !rawCols.length || rawCols.includes(k)) as ColKey[];
  const show = (k: ColKey) => cols.includes(k);

  const filters: ContactFilters = { q, kind, tag, archived, sort, dir, page };
  const [role, uid, views, { rows, total, owners, error, page: current }] = await Promise.all([
    getCurrentRole(),
    getUserId(),
    listViews("contacts"),
    listContacts(filters),
  ]);

  const params = (over: Record<string, string | undefined>, withPage = true) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q, kind, tag, archived: archived ? "1" : undefined, sort, dir, ...(withPage ? { page: String(current) } : {}), ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    if (rawCols.length) for (const c of cols) p.append("cols", c);
    return p.toString();
  };
  const href = (over: Record<string, string | undefined>) => `/contacts?${params(over)}`;
  const sortHref = (col: "name" | "created_at") =>
    href({ sort: col, dir: sort === col && dir === "asc" ? "desc" : "asc", page: "1" });

  const writable = !!role && canWrite(role);
  const staff = !!role && isStaffRole(role);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentFilters = Object.fromEntries(
    Object.entries({ q, kind, tag, archived: archived ? "1" : undefined, sort, dir }).filter(([, v]) => v),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{archived ? "Contactos archivados" : "Contactos"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {staff && <Link href="/contacts/duplicates" className="btn btn-secondary">Duplicados</Link>}
          {writable && <Link href="/contacts/import" className="btn btn-secondary">Importar CSV</Link>}
          <a href={`/contacts/export?${params({}, false)}`} className="btn btn-secondary">Exportar CSV</a>
          {writable && <Link href="/contacts/new" className="btn btn-primary">Nuevo contacto</Link>}
        </div>
      </div>

      <ViewMessages saved={sp.view_saved} error={sp.view_error} />
      <SavedViewsBar entity="contacts" basePath="/contacts" views={views} uid={uid} />

      <form method="get" role="search" className="card toolbar">
        <label className="field">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Nombre, email, NIF, teléfono" className={`${inputClass} w-72`} />
        </label>
        <label className="field">
          Tipo
          <select name="kind" defaultValue={kind ?? ""} className={inputClass}>
            <option value="">Todos</option>
            <option value="person">Personas</option>
            <option value="company">Empresas</option>
          </select>
        </label>
        <label className="field">
          Etiqueta
          <input name="tag" autoComplete="off" defaultValue={tag} className={`${inputClass} w-36`} />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} />
          Ver archivados
        </label>
        <details className="relative">
          <summary className="btn btn-secondary cursor-pointer list-none">Columnas</summary>
          <div className="absolute z-10 mt-2 flex w-48 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
            {COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-2">
                <input type="checkbox" name="cols" value={c.key} defaultChecked={show(c.key)} /> {c.label}
              </label>
            ))}
          </div>
        </details>
        <button type="submit" className="btn btn-secondary">Aplicar</button>
      </form>

      {writable && (
        <SaveViewForm
          entity="contacts"
          filters={currentFilters}
          columns={rawCols.length ? cols : []}
          canShare={staff}
          placeholder="Ej.: Empresas VIP"
        />
      )}

      {error && <p role="alert" className="alert-error">No se pudieron cargar los contactos.</p>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th><Link href={sortHref("name")}>Nombre{sort === "name" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link></th>
              {show("kind") && <th>Tipo</th>}
              {show("email") && <th>Email</th>}
              {show("phone") && <th>Teléfono</th>}
              {show("tags") && <th>Etiquetas</th>}
              {show("owner") && <th>Responsable</th>}
              {show("created") && <th><Link href={sortHref("created_at")}>Alta{sort === "created_at" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/contacts/${c.id}`} className="link">{c.name}</Link></td>
                {show("kind") && <td>{CONTACT_KIND_LABELS[c.kind as ContactKind]}</td>}
                {show("email") && <td>{c.email ?? "—"}</td>}
                {show("phone") && <td>{c.phone ?? "—"}</td>}
                {show("tags") && <td>{c.tags.join(", ") || "—"}</td>}
                {show("owner") && <td>{(c.owner_id && owners.get(c.owner_id)) || "—"}</td>}
                {show("created") && <td>{fmtDate(c.created_at)}</td>}
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted">
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
