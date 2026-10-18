import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { getUserId } from "@/lib/modules/tasks/queries";
import { listViews } from "@/lib/modules/views/queries";
import { SavedViewsBar, SaveViewForm, ViewMessages } from "@/components/views/SavedViews";
import { listOpportunities } from "@/lib/modules/opportunities/queries";
import { changeStage } from "@/lib/modules/opportunities/actions";
import { pipelineStats, stageInfo } from "@/lib/modules/opportunities/calc";
import { OPEN_STAGES, STAGES, type Stage } from "@/lib/modules/opportunities/types";
import { formatMoney } from "@/lib/modules/time/calc";
import { fmtDate } from "@/lib/modules/format";
import { StatusBadge } from "@/components/cases/StatusBadge";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  const sp = await searchParams;
  const q = first(sp.q) ?? "";
  const table = first(sp.view) === "table";
  const archived = first(sp.archived) === "1";
  const showClosed = first(sp.closed) === "1";

  const [role, uid, views, { rows, owners, error }] = await Promise.all([
    getCurrentRole(),
    getUserId(),
    listViews("opportunities"),
    listOpportunities({ q, archived }),
  ]);
  const writable = !!role && canWrite(role);
  const staff = !!role && isStaffRole(role);
  const stats = pipelineStats(rows);
  const stages = STAGES.filter((s) => showClosed || OPEN_STAGES.includes(s.key));
  const currentFilters = Object.fromEntries(
    Object.entries({ q, closed: showClosed ? "1" : undefined, archived: archived ? "1" : undefined }).filter(([, v]) => v),
  );

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { q, view: table ? "table" : undefined, archived: archived ? "1" : undefined, closed: showClosed ? "1" : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/opportunities?${p.toString()}`;
  };

  const kpis = [
    { label: "Oportunidades abiertas", value: String(stats.openCount) },
    { label: "Valor en el embudo", value: formatMoney(stats.openValue) },
    { label: "Valor ponderado", value: formatMoney(stats.weightedValue) },
    { label: "Tasa de éxito", value: stats.winRate === null ? "—" : `${Math.round(stats.winRate * 100)}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{archived ? "Oportunidades archivadas" : "Oportunidades"}</h1>
          <p className="page-sub">Del primer contacto a la contratación.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="segmented">
            <Link href={href({ view: undefined })} aria-current={!table ? "true" : undefined}>Embudo</Link>
            <Link href={href({ view: "table" })} aria-current={table ? "true" : undefined}>Tabla</Link>
          </div>
          {writable && <Link href="/opportunities/new" className="btn btn-primary">Nueva oportunidad</Link>}
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.label} className="card p-5">
            <p className="text-sm text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{k.value}</p>
          </li>
        ))}
      </ul>

      <ViewMessages saved={sp.view_saved} error={sp.view_error} />
      <SavedViewsBar entity="opportunities" basePath="/opportunities" views={views} uid={uid} />

      <form method="get" role="search" className="card toolbar">
        {table && <input type="hidden" name="view" value="table" />}
        <label className="field">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Título" className="input w-64" />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="closed" value="1" defaultChecked={showClosed} /> Mostrar ganadas y perdidas</label>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="archived" value="1" defaultChecked={archived} /> Ver archivadas</label>
        <button type="submit" className="btn btn-secondary">Filtrar</button>
      </form>

      {writable && (
        <SaveViewForm entity="opportunities" filters={currentFilters} canShare={staff} placeholder="Ej.: Oportunidades calientes" />
      )}

      {error && <p role="alert" className="alert-error">No se pudieron cargar las oportunidades. ¿Está aplicada la migración?</p>}

      {!table ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stages.map((s) => {
            const col = rows.filter((r) => r.stage === s.key);
            const total = stats.byStage[s.key].value;
            return (
              <section key={s.key} className="w-72 shrink-0 rounded-xl bg-slate-100 p-3">
                <h2 className="mb-1 flex items-center justify-between text-sm font-semibold">
                  <StatusBadge status={{ key: s.key, label: s.label, color: s.color }} />
                  <span className="text-muted">{col.length}</span>
                </h2>
                <p className="mb-3 text-xs text-muted">{formatMoney(total)}</p>
                <ul className="flex flex-col gap-2">
                  {col.map((o) => (
                    <li key={o.id} className="card p-3 text-sm">
                      <Link href={`/opportunities/${o.id}`} className="link">{o.title}</Link>
                      <p className="mt-1 text-xs text-muted">{o.contacts?.name}</p>
                      <p className="mt-1 flex justify-between text-xs">
                        <span className="font-semibold">{o.expected_value != null ? formatMoney(o.expected_value) : "—"}</span>
                        <span className="text-muted">{o.expected_close ? `cierre ${fmtDate(`${o.expected_close}T12:00:00Z`)}` : (o.owner_id && owners.get(o.owner_id)) || ""}</span>
                      </p>
                      {writable && s.key !== "won" && s.key !== "lost" && (
                        <form action={changeStage.bind(null, o.id)} className="mt-2 flex gap-1">
                          <input type="hidden" name="back" value="board" />
                          <select name="stage" defaultValue={o.stage} aria-label="Cambiar fase" className="input h-8 min-w-0 flex-1 text-xs">
                            {STAGES.filter((x) => x.key !== "won" && x.key !== "lost").map((x) => (<option key={x.key} value={x.key}>{x.label}</option>))}
                          </select>
                          <button type="submit" className="btn btn-secondary btn-sm">Mover</button>
                        </form>
                      )}
                    </li>
                  ))}
                  {col.length === 0 && <li className="py-2 text-center text-xs text-slate-400">Sin oportunidades</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead><tr><th>Oportunidad</th><th>Cliente</th><th>Fase</th><th>Valor</th><th>Prob.</th><th>Cierre previsto</th><th>Responsable</th></tr></thead>
            <tbody>
              {rows.filter((r) => showClosed || OPEN_STAGES.includes(r.stage as Stage)).map((o) => {
                const s = stageInfo(o.stage);
                return (
                  <tr key={o.id}>
                    <td><Link href={`/opportunities/${o.id}`} className="link">{o.title}</Link></td>
                    <td>{o.contacts?.name ?? "—"}</td>
                    <td><StatusBadge status={{ key: s.key, label: s.label, color: s.color }} /></td>
                    <td className="tabular-nums">{o.expected_value != null ? formatMoney(o.expected_value) : "—"}</td>
                    <td>{o.probability ?? s.probability}%</td>
                    <td>{o.expected_close ? fmtDate(`${o.expected_close}T12:00:00Z`) : "—"}</td>
                    <td>{(o.owner_id && owners.get(o.owner_id)) || "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && !error && <tr><td colSpan={7} className="py-10 text-center text-muted">Aún no hay oportunidades.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
