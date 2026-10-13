import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listMonthEvents } from "@/lib/modules/clock/queries";
import { buildSessions, currentState, fmtHM, isMonth, monthRange, summarizeDays, type ClockEvent } from "@/lib/modules/clock/calc";
import { nowMs, todayMadrid } from "@/lib/modules/format";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const STATE = { off: "Fuera", working: "Trabajando", paused: "En pausa" } as const;
const DOT = { off: "bg-slate-300", working: "bg-emerald-500", paused: "bg-amber-500" } as const;

export default async function ClockTeamPage({ searchParams }: PageProps<"/clock/team">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/clock");
  const sp = await searchParams;
  const monthParam = first(sp.month);
  const month = isMonth(monthParam) ? monthParam : todayMadrid().slice(0, 7);
  const r = monthRange(month);

  const [members, events] = await Promise.all([listMembers(), listMonthEvents(month)]);
  const now = nowMs();
  const byUser = new Map<string, ClockEvent[]>();
  for (const e of events) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);

  const rows = members
    .filter((m) => byUser.has(m.user_id) || role === "owner" || role === "admin")
    .map((m) => {
      const evs = byUser.get(m.user_id) ?? [];
      const { sessions, anomalies } = buildSessions(evs, now);
      const days = summarizeDays(sessions, evs);
      const inMonth = [...days.values()].filter((d) => d.day.startsWith(month));
      return {
        member: m,
        worked: inMonth.reduce((s, d) => s + d.workedMin, 0),
        days: inMonth.length,
        anomalies,
        state: currentState(evs),
      };
    });

  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/clock" className="link text-sm">← Mi fichaje</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title capitalize">Equipo · {monthLabel}</h1>
          <div className="flex items-center gap-2">
            <Link href={`/clock/team?month=${r.prev}`} className="btn btn-secondary btn-sm" aria-label="Mes anterior">←</Link>
            <Link href="/clock/team" className="btn btn-secondary btn-sm">Este mes</Link>
            <Link href={`/clock/team?month=${r.nextMonth}`} className="btn btn-secondary btn-sm" aria-label="Mes siguiente">→</Link>
            <a href={`/clock/export?month=${month}&scope=team`} className="btn btn-secondary btn-sm">Resumen CSV</a>
            <a href={`/clock/export?month=${month}&scope=team&detail=events`} className="btn btn-secondary btn-sm">Registro completo CSV</a>
          </div>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead><tr><th>Persona</th><th>Ahora</th><th>Días trabajados</th><th>Horas del mes</th><th>Incidencias</th><th /></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.member.user_id}>
                <td className="font-medium">{x.member.full_name}</td>
                <td><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${DOT[x.state]}`} />{STATE[x.state]}</span></td>
                <td>{x.days}</td>
                <td className="tabular-nums">{fmtHM(x.worked)} h</td>
                <td>{x.anomalies > 0 ? <span className="text-danger">{x.anomalies} incoherentes</span> : "—"}</td>
                <td className="text-right"><Link href={`/clock/team/${x.member.user_id}?month=${month}`} className="link">Ver detalle</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted">No hay fichajes en este mes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
