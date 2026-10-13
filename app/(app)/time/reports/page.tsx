import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { buildTimeReport, defaultPeriod } from "@/lib/modules/time/report";
import { formatHours, formatMoney } from "@/lib/modules/time/calc";
import { isDateString, todayMadrid } from "@/lib/modules/format";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const LEVEL_STYLE = { none: "", ok: "bg-emerald-500", warn: "bg-amber-500", over: "bg-red-500" } as const;

export default async function ReportsPage({ searchParams }: PageProps<"/time/reports">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/time");
  const showMoney = isAdminRole(role);

  const sp = await searchParams;
  const def = defaultPeriod(todayMadrid());
  const fromP = first(sp.from);
  const toP = first(sp.to);
  const from = isDateString(fromP) ? fromP : def.from;
  const to = isDateString(toP) ? toP : def.to;
  const byParam = first(sp.by);
  const by = byParam === "client" || byParam === "user" ? byParam : "case";

  const report = await buildTimeReport(from, to);
  const exportHref = `/time/reports/export?from=${from}&to=${to}&by=${by}`;
  const tab = "tab";
  const q = (b: string) => `/time/reports?from=${from}&to=${to}&by=${b}`;

  const kpis = [
    { label: "Horas en el periodo", value: formatHours(report.totals.minutes) + " h" },
    { label: "Horas facturables", value: formatHours(report.totals.billable) + " h" },
    ...(showMoney
      ? [
          { label: "Coste de personal", value: formatMoney(report.totals.cost) },
          { label: "Valor de las horas", value: formatMoney(report.totals.value) },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/time" className="link text-sm">← Mis horas</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Rentabilidad y horas</h1>
          <a href={exportHref} className="btn btn-secondary">Exportar CSV</a>
        </div>
      </div>

      <form method="get" className="card toolbar">
        <input type="hidden" name="by" value={by} />
        <label className="field">Desde<input type="date" name="from" defaultValue={from} className="input" /></label>
        <label className="field">Hasta<input type="date" name="to" defaultValue={to} className="input" /></label>
        <button type="submit" className="btn btn-secondary">Aplicar</button>
      </form>

      {report.error && <p role="alert" className="alert-error">No se pudo cargar el informe. ¿Está aplicada la migración de tiempos?</p>}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.label} className="card p-5">
            <p className="text-sm text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{k.value}</p>
          </li>
        ))}
      </ul>

      <nav className="tabs" aria-label="Agrupar por">
        <Link href={q("case")} aria-current={by === "case" ? "page" : undefined} className={tab}>Por proyecto</Link>
        <Link href={q("client")} aria-current={by === "client" ? "page" : undefined} className={tab}>Por cliente</Link>
        <Link href={q("user")} aria-current={by === "user" ? "page" : undefined} className={tab}>Por persona</Link>
      </nav>

      {by === "case" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th><th>Cliente</th><th>Horas periodo</th><th>Acumulado / presupuesto</th>
                {showMoney && (<><th>Coste</th><th>Honorarios</th><th>Margen</th></>)}
              </tr>
            </thead>
            <tbody>
              {report.byCase.map((c) => (
                <tr key={c.caseId ?? "internal"}>
                  <td>
                    {c.caseId ? <Link href={`/cases/${c.caseId}`} className="link">{c.code}</Link> : <span className="font-medium">{c.code}</span>}
                    <span className="block text-xs text-muted">{c.title}</span>
                  </td>
                  <td>{c.client}</td>
                  <td className="tabular-nums">{formatHours(c.periodMinutes)} h</td>
                  <td className="min-w-48">
                    <span className="tabular-nums">{formatHours(c.totalMinutes)} h{c.budgetHours != null && ` / ${c.budgetHours} h`}</span>
                    {c.pct !== null && (
                      <span className="mt-1 flex items-center gap-2">
                        <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
                          <span className={`block h-full ${LEVEL_STYLE[c.level]}`} style={{ width: `${Math.min(100, c.pct)}%` }} />
                        </span>
                        <span className={`text-xs font-medium ${c.level === "over" ? "text-danger" : c.level === "warn" ? "text-amber-600" : "text-muted"}`}>
                          {Math.round(c.pct)}%{c.level === "over" ? " · excedido" : c.level === "warn" ? " · en riesgo" : ""}
                        </span>
                      </span>
                    )}
                  </td>
                  {showMoney && (
                    <>
                      <td className="tabular-nums">{formatMoney(c.cost)}</td>
                      <td className="tabular-nums">{formatMoney(c.feeAmount)}</td>
                      <td className={`tabular-nums font-medium ${c.margin !== null && c.margin < 0 ? "text-danger" : ""}`}>{formatMoney(c.margin)}</td>
                    </>
                  )}
                </tr>
              ))}
              {report.byCase.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted">No hay horas en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {by === "client" && (
        <div className="table-card">
          <table>
            <thead><tr><th>Cliente</th><th>Proyectos</th><th>Horas</th><th>Facturables</th>{showMoney && (<><th>Coste</th><th>Valor</th></>)}</tr></thead>
            <tbody>
              {report.byClient.map((c) => (
                <tr key={c.key}>
                  <td className="font-medium">{c.name}</td><td>{c.cases}</td>
                  <td className="tabular-nums">{formatHours(c.minutes)} h</td><td className="tabular-nums">{formatHours(c.billable)} h</td>
                  {showMoney && (<><td className="tabular-nums">{formatMoney(c.cost)}</td><td className="tabular-nums">{formatMoney(c.value)}</td></>)}
                </tr>
              ))}
              {report.byClient.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted">No hay horas en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {by === "user" && (
        <div className="table-card">
          <table>
            <thead><tr><th>Persona</th><th>Horas</th><th>Facturables</th><th>% facturable</th>{showMoney && (<><th>Coste</th><th>Valor</th></>)}</tr></thead>
            <tbody>
              {report.byUser.map((u) => (
                <tr key={u.key}>
                  <td className="font-medium">{u.name}</td>
                  <td className="tabular-nums">{formatHours(u.minutes)} h</td><td className="tabular-nums">{formatHours(u.billable)} h</td>
                  <td className="tabular-nums">{u.minutes ? Math.round((u.billable / u.minutes) * 100) : 0}%</td>
                  {showMoney && (<><td className="tabular-nums">{formatMoney(u.cost)}</td><td className="tabular-nums">{formatMoney(u.value)}</td></>)}
                </tr>
              ))}
              {report.byUser.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted">No hay horas en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!showMoney && <p className="text-xs text-muted">Los costes y márgenes solo los ven propietarios y administradores.</p>}
    </div>
  );
}
