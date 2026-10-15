import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { loadDashboard } from "@/lib/modules/dashboards/queries";
import { PERIOD_OPTIONS, percent, periodFor } from "@/lib/modules/dashboards/calc";
import { formatHours, formatMoney } from "@/lib/modules/time/calc";
import { STAGES } from "@/lib/modules/opportunities/types";
import { fmtDate, todayMadrid } from "@/lib/modules/format";
import { BarList, Kpi, PairBars, Widget } from "@/components/dashboards/Widgets";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const LEVEL = { none: "bg-slate-300", ok: "bg-emerald-500", warn: "bg-amber-500", over: "bg-red-500" } as const;

export default async function DashboardsPage({ searchParams }: PageProps<"/dashboards">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/");
  const admin = isAdminRole(role);

  const sp = await searchParams;
  const periodKey = first(sp.period) ?? "month";
  const period = periodFor(periodKey, todayMadrid());
  const d = await loadDashboard({ from: period.from, to: period.to, typeId: first(sp.type), isAdmin: admin });

  const openCases = d.statusRows.reduce((s, r) => s + r.value, 0);
  const funnel = d.funnel;
  const profit = d.profitability;
  const absorbed = profit ? profit.byCase.reduce((sum, c) => sum + (c.expenses - c.expensesBillable), 0) : 0;
  const totalMargin = profit && profit.totals.fee !== null && profit.totals.cost !== null ? profit.totals.fee - profit.totals.cost - absorbed : null;
  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { period: periodKey, type: d.selectedTypeId ?? undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/dashboards?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Cuadros de mando</h1>
          <p className="page-sub">{period.label}: {fmtDate(`${period.from}T12:00:00Z`)} – {fmtDate(`${period.to}T12:00:00Z`)}</p>
        </div>
        <div className="segmented">
          {PERIOD_OPTIONS.map((o) => (
            <Link key={o.key} href={q({ period: o.key })} aria-current={periodKey === o.key || (!PERIOD_OPTIONS.some((x) => x.key === periodKey) && o.key === "month") ? "true" : undefined}>{o.label}</Link>
          ))}
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><Kpi label="Proyectos abiertos" value={String(openCases)} hint={d.selectedTypeId ? "del tipo seleccionado" : undefined} /></li>
        <li><Kpi label="Tareas vencidas" value={String(d.overdue.total)} tone={d.overdue.total > 0 ? "danger" : "ok"} /></li>
        <li><Kpi label="Valor en el embudo" value={formatMoney(funnel?.openValue ?? 0)} hint={`ponderado ${formatMoney(funnel?.weightedValue ?? 0)}`} /></li>
        <li><Kpi label="Horas imputadas" value={`${formatHours(d.workload.reduce((s, w) => s + w.minutes, 0))} h`} hint="en el periodo" /></li>
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Widget
          title="Proyectos por estado"
          subtitle="Expedientes abiertos de un tipo"
          action={
            d.types.length > 1 ? (
              <form method="get" className="flex items-center gap-2">
                <input type="hidden" name="period" value={periodKey} />
                <select name="type" defaultValue={d.selectedTypeId ?? ""} aria-label="Tipo de expediente" className="input h-8 w-auto text-xs">
                  {d.types.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
                <button type="submit" className="btn btn-secondary btn-sm">Ver</button>
              </form>
            ) : null
          }
        >
          <BarList rows={d.statusRows} empty="Aún no hay expedientes abiertos." />
        </Widget>

        <Widget title="Horas frente a presupuesto" subtitle="Proyectos abiertos con horas presupuestadas">
          {d.budgetRisk.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Ningún proyecto tiene horas presupuestadas todavía.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {d.budgetRisk.map((b) => (
                <li key={b.id}>
                  <p className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/cases/${b.id}`} className="link truncate">{b.code} · {b.title}</Link>
                    <span className={`shrink-0 font-semibold tabular-nums ${b.level === "over" ? "text-danger" : b.level === "warn" ? "text-amber-600" : ""}`}>{Math.round(b.pct)}%</span>
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${LEVEL[b.level]}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{formatHours(b.logged)} h de {b.budget} h</p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Carga por persona" subtitle="Tareas abiertas, vencidas y horas del periodo">
          {d.workload.length === 0 ? <p className="py-4 text-center text-sm text-muted">Sin datos.</p> : (
            <div className="table-card !shadow-none">
              <table>
                <thead><tr><th>Persona</th><th>Abiertas</th><th>Vencidas</th><th>Horas</th></tr></thead>
                <tbody>
                  {d.workload.map((w) => (
                    <tr key={w.userId}>
                      <td className="font-medium">{w.name}</td><td>{w.openTasks}</td>
                      <td className={w.overdue ? "font-semibold text-danger" : ""}>{w.overdue || "—"}</td>
                      <td className="tabular-nums">{formatHours(w.minutes)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Widget>

        <Widget title="Tareas vencidas" subtitle={`${d.overdue.total} en total`} action={<Link href="/tasks?scope=team" className="link text-sm">Ver tareas</Link>}>
          <ul className="flex flex-col divide-y divide-slate-100">
            {d.overdue.items.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0"><Link href={`/tasks/${t.id}`} className="link block truncate">{t.title}</Link>
                  <span className="text-xs text-muted">{t.assignee}{t.code ? ` · ${t.code}` : ""}</span></span>
                <span className="shrink-0 text-xs font-medium text-danger">{fmtDate(`${t.due}T12:00:00Z`)}</span>
              </li>
            ))}
            {d.overdue.items.length === 0 && <li className="py-6 text-center text-sm text-muted">No hay tareas vencidas. 🎉</li>}
          </ul>
        </Widget>

        <Widget title="Embudo comercial" subtitle={funnel?.winRate != null ? `Tasa de éxito ${Math.round(funnel.winRate * 100)}% (${funnel.wonCount} ganadas, ${funnel.lostCount} perdidas)` : "Oportunidades abiertas por fase"} action={<Link href="/opportunities" className="link text-sm">Abrir</Link>}>
          <BarList
            rows={STAGES.filter((s) => s.key !== "won" && s.key !== "lost").map((s) => ({ key: s.key, label: `${s.label} (${funnel?.byStage[s.key].count ?? 0})`, value: funnel?.byStage[s.key].value ?? 0, color: s.color }))}
            format={formatMoney}
            empty="Aún no hay oportunidades."
          />
        </Widget>

        <Widget title="Ocupación de la agenda" subtitle="Horas reservadas frente a la jornada laboral del periodo">
          {d.occupancy.length === 0 ? <p className="py-4 text-center text-sm text-muted">No hay recursos configurados.</p> : (
            <ul className="flex flex-col gap-3">
              {d.occupancy.map((o) => {
                const pct = percent(o.booked, o.capacity);
                return (
                  <li key={o.name}>
                    <p className="mb-1 flex justify-between text-sm"><span>{o.name}</span><span className="font-semibold tabular-nums">{pct}% · {formatHours(o.booked)} h</span></p>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: o.color }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>

        {admin && profit && (
          <Widget title="Rentabilidad" subtitle="Solo propietarios y administradores" action={<Link href="/time/reports" className="link text-sm">Informe</Link>}>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-muted">Coste de personal</dt><dd className="text-lg font-bold">{formatMoney(profit.totals.cost)}</dd></div>
              <div><dt className="text-muted">Valor de las horas</dt><dd className="text-lg font-bold">{formatMoney(profit.totals.value)}</dd></div>
              <div><dt className="text-muted">Honorarios (proyectos con horas)</dt><dd className="text-lg font-bold">{formatMoney(profit.totals.fee)}</dd></div>
              <div><dt className="text-muted">Margen (tras gastos no repercutibles)</dt><dd className={`text-lg font-bold ${totalMargin !== null && totalMargin < 0 ? "text-danger" : ""}`}>{formatMoney(totalMargin)}</dd></div>
            </dl>
            <BarList
              rows={profit.byCase.filter((c) => c.margin !== null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)).slice(0, 5).map((c) => ({ key: c.caseId ?? c.code, label: `${c.code} · ${c.title}`, value: Math.abs(c.margin ?? 0), color: (c.margin ?? 0) < 0 ? "#dc2626" : "#15803d" }))}
              format={formatMoney}
              empty="Define horas, tarifas y honorarios para ver el margen por proyecto."
            />
          </Widget>
        )}

        {admin && d.utilization && (
          <Widget title="Horas fichadas frente a imputadas" subtitle="¿Cuánto del tiempo trabajado se imputa a proyectos?">
            <PairBars
              rows={d.utilization.map((u) => ({ key: u.name, label: u.name, a: u.clocked, b: u.logged }))}
              aLabel="Fichadas" bLabel="Imputadas" fmt={(v) => `${formatHours(v)} h`}
            />
          </Widget>
        )}
      </div>
    </div>
  );
}
