import Link from "next/link";
import { Play, Square } from "lucide-react";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { getUserId, listCaseOptions } from "@/lib/modules/tasks/queries";
import { getRunningEntry, listEntries, listMyOpenTasks } from "@/lib/modules/time/queries";
import { deleteEntry, startTimer, stopTimer } from "@/lib/modules/time/actions";
import { formatMinutes } from "@/lib/modules/time/calc";
import { addDays, isDateString, madridParts, madridToUtc, mondayOf, todayMadrid } from "@/lib/modules/format";
import { Elapsed } from "@/components/time/Elapsed";
import { ManualEntryForm } from "@/components/time/ManualEntryForm";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TimePage({ searchParams }: PageProps<"/time">) {
  const sp = await searchParams;
  const today = todayMadrid();
  const weekParam = first(sp.week);
  const monday = mondayOf(isDateString(weekParam) ? weekParam : today);
  const uid = await getUserId();
  const role = await getCurrentRole();
  const writable = !!role && canWrite(role);

  const [running, entries, cases, tasks] = await Promise.all([
    uid ? getRunningEntry(uid) : Promise.resolve(null),
    listEntries({
      userId: uid ?? undefined,
      fromIso: madridToUtc(monday, "00:00").toISOString(),
      toIso: madridToUtc(addDays(monday, 7), "00:00").toISOString(),
    }),
    listCaseOptions(),
    uid ? listMyOpenTasks(uid) : Promise.resolve([]),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const d = madridParts(e.started_at).date;
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const weekTotal = entries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" });
  const nav = "btn btn-secondary btn-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Mis horas</h1>
          <p className="page-sub">Imputa tu tiempo a proyectos para controlar la rentabilidad.</p>
        </div>
        {role && isStaffRole(role) && <Link href="/time/reports" className="btn btn-secondary">Informes de rentabilidad</Link>}
      </div>

      {typeof sp.error === "string" && (
        <p role="alert" className="alert-error">
          {sp.error === "running" ? "Ya tienes un temporizador en marcha. Páralo antes de iniciar otro." : "No se pudo iniciar el temporizador."}
        </p>
      )}

      <section className="card p-6">
        {running ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Temporizador en marcha</p>
              <p className="mt-1 font-heading text-4xl font-bold tabular-nums"><Elapsed since={running.started_at} /></p>
              <p className="mt-1 text-sm">
                {running.cases ? `${running.cases.code} · ${running.cases.title}` : "Sin expediente"}
                {running.description ? ` — ${running.description}` : ""}
              </p>
            </div>
            <form action={stopTimer}>
              <button type="submit" className="btn btn-primary"><Square size={16} /> Parar</button>
            </form>
          </div>
        ) : writable ? (
          <form action={startTimer} className="flex flex-wrap items-end gap-3">
            <label className="field min-w-64 flex-1">
              Expediente
              <select name="case_id" className="input">
                <option value="">Sin expediente (tiempo interno)</option>
                {cases.map((c) => (<option key={c.id} value={c.id}>{c.code} · {c.title}</option>))}
              </select>
            </label>
            <label className="field min-w-48 flex-1">
              Tarea (opcional)
              <select name="task_id" className="input">
                <option value="">—</option>
                {tasks.map((t) => (<option key={t.id} value={t.id}>{t.cases?.code ? `${t.cases.code} · ` : ""}{t.title}</option>))}
              </select>
            </label>
            <label className="field min-w-48 flex-1">
              Descripción
              <input name="description" className="input" placeholder="¿En qué trabajas?" />
            </label>
            <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="billable" defaultChecked /> Facturable</label>
            <button type="submit" className="btn btn-primary"><Play size={16} /> Iniciar</button>
          </form>
        ) : (
          <p className="text-sm text-muted">Tu rol es de solo lectura.</p>
        )}
      </section>

      {writable && (
        <details className="card p-6">
          <summary className="section-title cursor-pointer">Añadir horas manualmente</summary>
          <div className="mt-4">
            <ManualEntryForm cases={cases} tasks={tasks} today={today} />
          </div>
        </details>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Semana del {monday.slice(8)}/{monday.slice(5, 7)} · {formatMinutes(weekTotal)}</h2>
          <div className="flex items-center gap-2">
            <Link href={`/time?week=${addDays(monday, -7)}`} className={nav} aria-label="Semana anterior">←</Link>
            <Link href="/time" className={nav}>Esta semana</Link>
            <Link href={`/time?week=${addDays(monday, 7)}`} className={nav} aria-label="Semana siguiente">→</Link>
          </div>
        </div>
        <div className="table-card">
          <table>
            <thead><tr><th>Día</th><th>Proyecto / tarea</th><th>Descripción</th><th>Horas</th><th /></tr></thead>
            <tbody>
              {days.flatMap((d) => {
                const list = byDay.get(d) ?? [];
                const total = list.reduce((s, e) => s + (e.minutes ?? 0), 0);
                if (!list.length) {
                  return [
                    <tr key={d}><td className="capitalize text-muted">{label(d)}</td><td colSpan={4} className="text-slate-400">—</td></tr>,
                  ];
                }
                return list.map((e, i) => (
                  <tr key={e.id}>
                    <td className="capitalize font-medium">{i === 0 ? <>{label(d)} <span className="ml-1 text-xs font-normal text-muted">({formatMinutes(total)})</span></> : ""}</td>
                    <td>
                      {e.case_id && e.cases ? <Link href={`/cases/${e.case_id}`} className="link">{e.cases.code}</Link> : <span className="text-muted">Interno</span>}
                      {e.tasks && <span className="text-muted"> · {e.tasks.title}</span>}
                    </td>
                    <td>{e.description ?? "—"}{!e.billable && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-muted">no facturable</span>}</td>
                    <td className="tabular-nums">{formatMinutes(e.minutes)}</td>
                    <td className="text-right">
                      {writable && (
                        <form action={deleteEntry.bind(null, e.id)}>
                          <input type="hidden" name="back" value={`/time?week=${monday}`} />
                          <button type="submit" className="link-danger text-sm">Eliminar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
