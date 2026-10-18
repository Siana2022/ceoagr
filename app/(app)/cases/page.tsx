import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { CASES_PAGE_SIZE, listCases, listCaseTypes, type CaseFilters } from "@/lib/modules/cases/queries";
import { changeCaseStatus } from "@/lib/modules/cases/actions";
import { PRIORITY_LABELS, type Priority } from "@/lib/modules/cases/types";
import { fmtDate } from "@/lib/modules/format";
import { StatusBadge } from "@/components/cases/StatusBadge";
import { inputClass } from "@/components/form-styles";
import { getUserId } from "@/lib/modules/tasks/queries";
import { listViews } from "@/lib/modules/views/queries";
import { SavedViewsBar, SaveViewForm, ViewMessages } from "@/components/views/SavedViews";
import { isStaffRole } from "@/lib/modules/nav";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const sp = await searchParams;
  const types = await listCaseTypes(true);
  const q = first(sp.q) ?? "";
  const board = first(sp.view) === "board";
  const archived = first(sp.archived) === "1";
  const requestedType = first(sp.type);
  const typeId = types.find((t) => t.id === requestedType)?.id ?? (board ? types.find((t) => !t.archived)?.id : undefined);
  const status = first(sp.status) ?? "";
  const sort = (["created_at", "due_at", "code"] as const).find((s) => s === first(sp.sort)) ?? "created_at";
  const dir = first(sp.dir) === "asc" ? "asc" : "desc";
  const page = Number.parseInt(first(sp.page) ?? "1", 10) || 1;

  const filters: CaseFilters = { q, typeId, status: board ? undefined : status || undefined, archived, sort, dir, page, all: board };
  const [role, uid, views, { rows, total, owners, error, page: current }] = await Promise.all([
    getCurrentRole(),
    getUserId(),
    listViews("cases"),
    listCases(filters),
  ]);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const selectedType = typeId ? typeById.get(typeId) : undefined;
  const writable = !!role && canWrite(role);
  const staff = !!role && isStaffRole(role);
  const currentFilters = Object.fromEntries(
    Object.entries({ q, type: typeId, status, archived: archived ? "1" : undefined, sort, dir }).filter(([, v]) => v),
  );

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q, type: typeId, status, view: board ? "board" : undefined, archived: archived ? "1" : undefined,
      sort, dir, page: String(current), ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/cases?${p.toString()}`;
  };
  const sortHref = (col: string) => href({ sort: col, dir: sort === col && dir === "asc" ? "desc" : "asc", page: "1" });
  const pages = Math.max(1, Math.ceil(total / CASES_PAGE_SIZE));
  const activeTypes = types.filter((t) => !t.archived);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{archived ? "Expedientes archivados" : "Expedientes"}</h1>
        <div className="flex items-center gap-3">
          <div className="segmented">
            <Link href={href({ view: undefined, page: "1" })} aria-current={!board ? "true" : undefined}>Tabla</Link>
            <Link href={href({ view: "board", page: "1" })} aria-current={board ? "true" : undefined}>Tablero</Link>
          </div>
          {role && canWrite(role) && (
            <Link href={`/cases/new${typeId ? `?type=${typeId}` : ""}`} className="btn btn-primary">
              Nuevo expediente
            </Link>
          )}
        </div>
      </div>

      {!board && (
        <>
          <ViewMessages saved={sp.view_saved} error={sp.view_error} />
          <SavedViewsBar entity="cases" basePath="/cases" views={views} uid={uid} />
        </>
      )}

      <form method="get" role="search" className="card toolbar">
        {board && <input type="hidden" name="view" value="board" />}
        <label className="field">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Título o código" className={`${inputClass} h-10 w-64`} />
        </label>
        <label className="field">
          Tipo
          <select name="type" defaultValue={typeId ?? ""} className={`${inputClass} h-10`}>
            {!board && <option value="">Todos</option>}
            {types.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </label>
        {!board && selectedType && (
          <label className="field">
            Estado
            <select name="status" defaultValue={status} className={`${inputClass} h-10`}>
              <option value="">Todos</option>
              {selectedType.pipeline.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </select>
          </label>
        )}
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} />
          Ver archivados
        </label>
        <button type="submit" className="btn btn-secondary">Filtrar</button>
      </form>

      {!board && writable && (
        <SaveViewForm entity="cases" filters={currentFilters} canShare={staff} placeholder="Ej.: Urgentes de este mes" />
      )}

      {error && <p role="alert" className="alert-error">No se pudieron cargar los expedientes.</p>}

      {activeTypes.length === 0 && (
        <p className="card p-5 text-sm">
          Aún no hay tipos de expediente. Un administrador debe crearlos en{" "}
          <Link href="/settings/case-types" className="link">Ajustes → Tipos de expediente</Link>.
        </p>
      )}

      {board && selectedType ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {selectedType.pipeline.map((s) => {
            const col = rows.filter((r) => r.status === s.key);
            return (
              <section key={s.key} className="w-72 shrink-0 rounded-xl bg-slate-100 p-3">
                <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
                  <StatusBadge status={s} />
                  <span className="text-muted">{col.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {col.map((c) => (
                    <li key={c.id} className="card p-3 text-sm">
                      <Link href={`/cases/${c.id}`} className="link">{c.code}</Link>
                      <p className="mt-1">{c.title}</p>
                      <p className="text-xs text-muted">{c.contacts?.name}</p>
                      {c.due_at && <p className="text-xs text-muted">Vence {fmtDate(c.due_at)}</p>}
                      {role && canWrite(role) && (
                        <form action={changeCaseStatus.bind(null, c.id)} className="mt-2 flex gap-1">
                          <input type="hidden" name="back" value="board" />
                          <select name="status" defaultValue={c.status} aria-label="Cambiar estado" className="input min-w-0 flex-1 text-xs">
                            {selectedType.pipeline.map((o) => (<option key={o.key} value={o.key}>{o.label}</option>))}
                          </select>
                          <button type="submit" className="btn btn-secondary btn-sm">Mover</button>
                        </form>
                      )}
                    </li>
                  ))}
                  {col.length === 0 && <li className="text-xs text-slate-400">Sin expedientes</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th><Link href={sortHref("code")}>Código{sort === "code" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link></th>
                  <th>Título</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th><Link href={sortHref("due_at")}>Vence{sort === "due_at" ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link></th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const st = typeById.get(c.case_type_id)?.pipeline.find((s) => s.key === c.status);
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/cases/${c.id}`} className="link">{c.code}</Link></td>
                      <td>{c.title}</td>
                      <td>{c.contacts?.name ?? "—"}</td>
                      <td><StatusBadge status={st} fallback={c.status} /></td>
                      <td>{PRIORITY_LABELS[c.priority as Priority]}</td>
                      <td>{fmtDate(c.due_at)}</td>
                      <td>{(c.owner_id && owners.get(c.owner_id)) || "—"}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && !error && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted">{q || typeId || status ? "Ningún expediente coincide con los filtros." : "Aún no hay expedientes."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{total} expediente{total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-3">
              {current > 1 ? <Link href={href({ page: String(current - 1) })} className="link">Anterior</Link> : <span className="text-slate-400">Anterior</span>}
              <span>Página {current} de {pages}</span>
              {current < pages ? <Link href={href({ page: String(current + 1) })} className="link">Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
