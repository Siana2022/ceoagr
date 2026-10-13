import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { listAppointments, listResources } from "@/lib/modules/agenda/queries";
import { addDays, isDateString, madridToUtc, mondayOf, todayMadrid } from "@/lib/modules/format";
import { MonthGrid, TimeGrid } from "@/components/agenda/CalendarViews";
import { inputClass } from "@/components/form-styles";
import { z } from "zod";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const today = todayMadrid();
  const dateParam = first(sp.date);
  const date = isDateString(dateParam) ? dateParam : today;
  const viewParam = first(sp.view);
  const view = viewParam === "day" || viewParam === "month" ? viewParam : "week";
  const resourceParam = first(sp.resource);
  const resourceId = z.uuid().safeParse(resourceParam).success ? resourceParam : undefined;

  let days: string[];
  let from: string;
  let to: string;
  let prev: string;
  let next: string;
  let title: string;
  let monthKey = date.slice(0, 7);

  if (view === "day") {
    days = [date];
    from = date;
    to = addDays(date, 1);
    prev = addDays(date, -1);
    next = addDays(date, 1);
    title = new Date(`${date}T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", dateStyle: "full" });
  } else if (view === "week") {
    const mon = mondayOf(date);
    days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    from = mon;
    to = addDays(mon, 7);
    prev = addDays(date, -7);
    next = addDays(date, 7);
    title = `Semana del ${mon.slice(8)}/${mon.slice(5, 7)} al ${addDays(mon, 6).slice(8)}/${addDays(mon, 6).slice(5, 7)}/${addDays(mon, 6).slice(0, 4)}`;
  } else {
    const first1 = `${monthKey}-01`;
    from = mondayOf(first1);
    to = addDays(from, 42);
    days = [];
    const d = new Date(`${first1}T00:00:00Z`);
    prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
    next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    title = `${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
    monthKey = first1.slice(0, 7);
  }

  const [role, resources, { rows, error }] = await Promise.all([
    getCurrentRole(),
    listResources(),
    listAppointments(madridToUtc(from, "00:00").toISOString(), madridToUtc(to, "00:00").toISOString(), resourceId),
  ]);

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { view, date, resource: resourceId, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/calendar?${p.toString()}`;
  };
  const nav = "btn btn-secondary btn-sm";
  const newHref = `/calendar/new?date=${date}${resourceId ? `&resource=${resourceId}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Agenda</h1>
        {role && canWrite(role) && resources.length > 0 && (
          <Link href={newHref} className="btn btn-primary">
            Nueva cita
          </Link>
        )}
      </div>

      {resources.length === 0 ? (
        <p className="card p-5 text-sm">
          Aún no hay recursos (profesionales, salas o equipos).{" "}
          {role && isStaffRole(role) ? (
            <Link href="/settings/resources" className="link">Crea el primero en Ajustes → Recursos</Link>
          ) : (
            "Un responsable debe crearlos en Ajustes."
          )}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href={href({ date: prev })} className={nav} aria-label="Anterior">←</Link>
              <Link href={href({ date: today })} className={nav}>Hoy</Link>
              <Link href={href({ date: next })} className={nav} aria-label="Siguiente">→</Link>
              <span className="ml-2 text-sm font-medium capitalize">{title}</span>
            </div>
            <div className="flex items-center gap-3">
              <form method="get" className="flex items-center gap-2">
                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="date" value={date} />
                <select name="resource" defaultValue={resourceId ?? ""} aria-label="Recurso" className={`${inputClass} h-9 w-auto`}>
                  <option value="">Todos los recursos</option>
                  {resources.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                </select>
                <button type="submit" className="btn btn-secondary btn-sm">Filtrar</button>
              </form>
              <div className="segmented">
                {(["day", "week", "month"] as const).map((v) => (
                  <Link key={v} href={href({ view: v })} aria-current={view === v ? "true" : undefined}>
                    {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <ul className="flex flex-wrap gap-3 text-xs">
            {resources.map((r) => (
              <li key={r.id} className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: r.color }} />
                {r.name}
              </li>
            ))}
          </ul>

          {error && <p role="alert" className="alert-error">No se pudo cargar la agenda.</p>}

          {view === "month" ? (
            <MonthGrid gridStart={from} month={monthKey} appts={rows} today={today} />
          ) : (
            <TimeGrid days={days} appts={rows} today={today} />
          )}
        </>
      )}
    </div>
  );
}
