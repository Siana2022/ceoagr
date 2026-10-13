import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listMonthEvents } from "@/lib/modules/clock/queries";
import { addManualEvent } from "@/lib/modules/clock/actions";
import { buildSessions, CLOCK_LABELS, fmtHM, isMonth, monthRange, summarizeDays } from "@/lib/modules/clock/calc";
import { fmtDateTime, fmtTime, nowMs, todayMadrid } from "@/lib/modules/format";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ClockUserPage({ params, searchParams }: PageProps<"/clock/team/[userId]">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/clock");
  const [{ userId }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(userId).success) notFound();

  const monthParam = first(sp.month);
  const month = isMonth(monthParam) ? monthParam : todayMadrid().slice(0, 7);
  const r = monthRange(month);

  const [members, events] = await Promise.all([listMembers(), listMonthEvents(month, userId)]);
  const member = members.find((m) => m.user_id === userId);
  if (!member) notFound();

  const { sessions, anomalies } = buildSessions(events, nowMs());
  const days = summarizeDays(sessions, events);
  const monthDays = [...days.values()].filter((d) => d.day.startsWith(month)).sort((a, b) => a.day.localeCompare(b.day));
  const total = monthDays.reduce((s, d) => s + d.workedMin, 0);
  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  const admin = isAdminRole(role);
  const inMonth = events.filter((e) => e.at >= `${month}-01`).reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/clock/team?month=${month}`} className="link text-sm">← Equipo</Link>
        <h1 className="page-title mt-1">{member.full_name}</h1>
        <p className="page-sub">{new Date(`${month}-01T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", month: "long", year: "numeric" })} · {fmtHM(total)} h · <Link href={`/clock/team/${userId}?month=${r.prev}`} className="link">mes anterior</Link> · <Link href={`/clock/team/${userId}?month=${r.nextMonth}`} className="link">mes siguiente</Link></p>
      </div>

      {sp.saved && <p role="status" className="alert-ok">Corrección registrada.</p>}
      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}
      {anomalies > 0 && <p className="alert-error">Hay {anomalies} fichajes incoherentes. Añade una corrección manual para cerrar la jornada.</p>}

      <div className="table-card">
        <table>
          <thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th>Pausas</th><th>Trabajadas</th><th /></tr></thead>
          <tbody>
            {monthDays.map((d) => (
              <tr key={d.day}>
                <td className="capitalize">{label(d.day)}</td>
                <td className="tabular-nums">{fmtTime(d.first)}</td>
                <td className="tabular-nums">{d.open ? "en curso" : d.last ? fmtTime(d.last) : "—"}</td>
                <td className="tabular-nums">{d.pauseMin ? `${d.pauseMin} min` : "—"}</td>
                <td className="tabular-nums font-medium">{fmtHM(d.workedMin)}</td>
                <td className="text-xs text-muted">{d.manual ? "incluye corrección" : ""}</td>
              </tr>
            ))}
            {monthDays.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted">Sin fichajes este mes.</td></tr>}
          </tbody>
        </table>
      </div>

      {admin && (
        <section className="card flex max-w-2xl flex-col gap-4 p-6">
          <h2 className="section-title">Añadir corrección manual</h2>
          <p className="text-sm text-muted">No se modifica el historial: se añade un registro nuevo, marcado como corrección, con su motivo. Queda visible en el registro completo.</p>
          <form action={addManualEvent.bind(null, userId)} className="grid gap-4 sm:grid-cols-3">
            <label className="field">Tipo
              <select name="kind" className="input">
                {Object.entries(CLOCK_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
              </select>
            </label>
            <label className="field">Fecha<input type="date" name="date" required defaultValue={todayMadrid()} className="input" /></label>
            <label className="field">Hora<input type="time" name="time" required className="input" /></label>
            <label className="field sm:col-span-3">Motivo *<input name="note" required minLength={3} className="input" placeholder="Ej.: Olvidó fichar la salida" /></label>
            <div><button type="submit" className="btn btn-primary">Registrar corrección</button></div>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Registro completo del mes</h2>
        <div className="table-card">
          <table>
            <thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Origen</th><th>Motivo</th></tr></thead>
            <tbody>
              {inMonth.map((e) => (
                <tr key={e.id}>
                  <td className="tabular-nums">{fmtDateTime(e.at)}</td><td>{CLOCK_LABELS[e.kind]}</td>
                  <td>{e.source === "manual" ? "Corrección manual" : e.source === "mobile" ? "Móvil" : "Web"}</td><td>{e.note ?? "—"}</td>
                </tr>
              ))}
              {inMonth.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">Sin registros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
