import Link from "next/link";
import { deleteView, saveView } from "@/lib/modules/views/actions";
import type { SavedView } from "@/lib/modules/views/types";

// Shared by the contacts, cases, tasks and opportunities lists: a row of
// saved-view chips plus a collapsible "save this view" form. Both are plain
// server-rendered links/forms (no client JS needed).

export function SavedViewsBar({
  entity,
  basePath,
  views,
  uid,
}: {
  entity: SavedView["entity"];
  basePath: string;
  views: SavedView[];
  uid: string | null;
}) {
  if (views.length === 0) return null;

  const viewHref = (v: SavedView) => {
    const p = new URLSearchParams(v.filters);
    for (const c of v.columns) p.append("cols", c);
    return `${basePath}?${p.toString()}`;
  };

  return (
    <ul className="flex flex-wrap items-center gap-2 text-sm" aria-label="Vistas guardadas">
      <li className="text-muted">Vistas:</li>
      {views.map((v) => (
        <li key={v.id} className="flex items-center overflow-hidden rounded-full border border-slate-300 bg-white">
          <Link href={viewHref(v)} className="px-3 py-1 font-medium hover:bg-slate-50">
            {v.name}
            {v.is_shared && <span className="ml-1 text-xs font-normal text-muted">(equipo)</span>}
          </Link>
          {v.user_id === uid && (
            <form action={deleteView.bind(null, entity, v.id)}>
              <button type="submit" aria-label={`Eliminar la vista ${v.name}`} className="border-l border-slate-200 px-2 py-1 text-muted hover:text-danger">
                ×
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SaveViewForm({
  entity,
  filters,
  columns = [],
  canShare,
  placeholder = "Ej.: Mis urgentes",
}: {
  entity: SavedView["entity"];
  filters: Record<string, string | undefined>;
  columns?: string[];
  canShare: boolean;
  placeholder?: string;
}) {
  return (
    <details className="text-sm">
      <summary className="link cursor-pointer">Guardar esta vista ({columns.length ? "filtros y columnas" : "filtros"})</summary>
      <form action={saveView.bind(null, entity)} className="card mt-3 flex max-w-xl flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="filters" value={JSON.stringify(filters)} />
        <input type="hidden" name="columns" value={JSON.stringify(columns)} />
        <label className="field">
          Nombre de la vista
          <input name="name" required maxLength={60} className="input w-56" placeholder={placeholder} />
        </label>
        {canShare && (
          <label className="flex h-10 items-center gap-2">
            <input type="checkbox" name="is_shared" /> Compartir con el equipo
          </label>
        )}
        <button type="submit" className="btn btn-primary">Guardar vista</button>
      </form>
    </details>
  );
}

export function ViewMessages({ saved, error }: { saved?: unknown; error?: unknown }) {
  return (
    <>
      {saved && <p role="status" className="alert-ok">Vista guardada.</p>}
      {error && <p role="alert" className="alert-error">No se pudo guardar la vista.</p>}
    </>
  );
}
