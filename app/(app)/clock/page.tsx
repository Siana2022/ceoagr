import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { getUserId } from "@/lib/modules/tasks/queries";
import { listMonthEvents } from "@/lib/modules/clock/queries";
import { buildSessions, CLOCK_LABELS, currentState, fmtHM, isMonth, monthRange, summarizeDays } from "@/lib/modules/clock/calc";
import { fmtTime, madridParts, nowMs, todayMadrid } from "@/lib/modules/format";
import { ClockPanel } from "@/components/clock/ClockPanel";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ClockPage({ searchParams }: PageProps<"/clock">) {
  const sp = await searchParams;
  const today = todayMadrid();
  const monthParam = first(sp.month);
  const month = isMonth(monthParam) ? monthParam : today.slice(0, 7);
  const uid = await getUserId();
  const role = await getCurrentRole();
  const r = monthRange(month);

  const [events, todayEvents] = await Promise.all([
    uid ? listMonthEvents(month, uid) : Promise.resolve([]),
    uid ? listMonthEvents(today.slice(0, 7), uid) : Promise.resolve([]),
  ]);
  const now = nowMs();

  const { sessions, anomalies } = buildSessions(events, now);
  const days = summarizeDays(sessions, events);
  const monthDays = Array.from({ length: r.daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const monthTotal = monthDays.reduce((s, d) => s + (days.get(d)?.workedMin ?? 0), 0);

  // Today's panel always uses the current month's events.
  const todaySessions = buildSessions(todayEvents, now).sessions;
  const state = currentState(todayEvents);
  const todayWorked = todaySessions.filter((s) => s.day === today).reduce((s, x) => s + x.workedMin, 0);
  const openSession = todaySessions.find((s) => s.open);
  const todaysEvents = todayEvents.filter((e) => madridParts(e.at).date === today);
  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", month: "long", year: "numeric" });
  const nav = "btn btn-secondary btn-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Fichaje</h1>
          <p className="page-sub">Registro de jornada. La hora la pone el servidor y los registros no se pueden borrar.</p>
        </div>
        {role && isStaffRole(role) && <Link href="/clock/team" className="btn btn-secondary">Ver equipo</Link>}
      </div>

      {sp.error && (
        <p role="alert" className="alert-error">
          {sp.error === "sequence" ? "Esa acción no es posible ahora (por ejemplo, ya has fichado la entrada)." : "No se pudo registrar el fichaje."}
        </p>
      )}

      <ClockPanel state={state} since={openSession?.start ?? null} workedMin={todayWorked} back="/clock" canClock={!!role} />

      <section className="card p-6">
        <h2 className="section-title mb-3">Hoy</h2>
        <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {todaysEvents.map((e) => (
            <li key={e.id}><span className="font-semibold tabular-nums">{fmtTime(e.at)}</span> <span className="text-muted">{CLOCK_LABELS[e.kind]}{e.source === "manual" ? " (corrección)" : ""}</span></li>
          ))}
          {todaysEvents.length === 0 && <li className="text-muted">Todavía no has fichado hoy.</li>}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title capitalize">{monthLabel} · {fmtHM(monthTotal)} h</h2>
          <div className="flex items-center gap-2">
            <Link href={`/clock?month=${r.prev}`} className={nav} aria-label="Mes anterior">←</Link>
            <Link href="/clock" className={nav}>Este mes</Link>
            <Link href={`/clock?month=${r.nextMonth}`} className={nav} aria-label="Mes siguiente">→</Link>
            <a href={`/clock/export?month=${month}`} className="btn btn-secondary btn-sm">Exportar CSV</a>
          </div>
        </div>
        {anomalies > 0 && <p className="alert-error text-sm">Hay {anomalies} fichajes con secuencia incoherente. Pide a un administrador que lo revise.</p>}
        <div className="table-card">
          <table>
            <thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th>Pausas</th><th>Trabajadas</th><th /></tr></thead>
            <tbody>
              {monthDays.map((d) => {
                const s = days.get(d);
                const weekend = [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
                return (
                  <tr key={d} className={weekend && !s ? "bg-slate-50/60" : ""}>
                    <td className="capitalize">{label(d)}</td>
                    <td className="tabular-nums">{s ? fmtTime(s.first) : "—"}</td>
                    <td className="tabular-nums">{s ? (s.open ? <span className="text-emerald-600">en curso</span> : s.last ? fmtTime(s.last) : "—") : "—"}</td>
                    <td className="tabular-nums">{s && s.pauseMin ? `${s.pauseMin} min` : "—"}</td>
                    <td className="tabular-nums font-medium">{s ? fmtHM(s.workedMin) : "—"}</td>
                    <td className="text-xs text-muted">{s?.manual ? "incluye corrección" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
