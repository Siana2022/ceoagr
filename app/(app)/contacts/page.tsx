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
        <h1 className="text-xl font-semibold">{archived ? "Contactos archivados" : "Contactos"}</h1>
        {role && canWrite(role) && (
          <Link href="/contacts/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
            Nuevo contacto
          </Link>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-sm">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Nombre, email, NIF, teléfono" className={`${inputClass} h-10 w-80`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select name="kind" defaultValue={kind ?? ""} className={`${inputClass} h-10`}>
            <option value="">Todos</option>
            <option value="person">Personas</option>
            <option value="company">Empresas</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Etiqueta
          <input name="tag" autoComplete="off" defaultValue={tag} className={`${inputClass} h-10 w-40`} />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} />
          Ver archivados
        </label>
        <button type="submit" className="h-10 rounded-md border border-zinc-300 px-4 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Filtrar
        </button>
      </form>

      {error && <p role="alert" className="text-sm text-red-600">No se pudieron cargar los contactos.</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="py-2 pr-4 font-medium">
                <Link href={sortHref("name")}>Nombre{sort === "name" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link>
              </th>
              <th className="py-2 pr-4 font-medium">Tipo</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Teléfono</th>
              <th className="py-2 pr-4 font-medium">Etiquetas</th>
              <th className="py-2 pr-4 font-medium">Responsable</th>
              <th className="py-2 font-medium">
                <Link href={sortHref("created_at")}>Alta{sort === "created_at" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4">
                  <Link href={`/contacts/${c.id}`} className="font-medium underline">{c.name}</Link>
                </td>
                <td className="py-2 pr-4">{CONTACT_KIND_LABELS[c.kind as ContactKind]}</td>
                <td className="py-2 pr-4">{c.email ?? "—"}</td>
                <td className="py-2 pr-4">{c.phone ?? "—"}</td>
                <td className="py-2 pr-4">{c.tags.join(", ") || "—"}</td>
                <td className="py-2 pr-4">{(c.owner_id && owners.get(c.owner_id)) || "—"}</td>
                <td className="py-2">{new Date(c.created_at).toLocaleDateString("es-ES")}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500">
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
          {current > 1 ? <Link href={href({ page: String(current - 1) })} className="underline">Anterior</Link> : <span className="text-zinc-400">Anterior</span>}
          <span>Página {current} de {pages}</span>
          {current < pages ? <Link href={href({ page: String(current + 1) })} className="underline">Siguiente</Link> : <span className="text-zinc-400">Siguiente</span>}
        </div>
      </div>
    </div>
  );
}
