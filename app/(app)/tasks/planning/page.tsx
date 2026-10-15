import Link from "next/link";
import { z } from "zod";
import { getCaseGanttData, listCaseOptions } from "@/lib/modules/tasks/queries";
import { buildGantt } from "@/lib/modules/tasks/gantt";
import { GanttChart, GanttLegend } from "@/components/tasks/GanttChart";
import { todayMadrid } from "@/lib/modules/format";
import { inputClass } from "@/components/form-styles";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/modules/tasks/types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PlanningPage({ searchParams }: PageProps<"/tasks/planning">) {
  const sp = await searchParams;
  const cases = await listCaseOptions();
  const requested = first(sp.case);
  const caseId = z.uuid().safeParse(requested).success && cases.some((c) => c.id === requested) ? requested! : cases[0]?.id;
  const zoom = first(sp.zoom) === "week" ? "week" : "day";
  const unit = zoom === "week" ? 12 : 32;

  const data = caseId ? await getCaseGanttData(caseId) : null;
  const gantt = data ? buildGantt(data.tasks, data.deps, todayMadrid()) : null;
  const current = cases.find((c) => c.id === caseId);
  const q = (over: Record<string, string>) => `/tasks/planning?${new URLSearchParams({ case: caseId ?? "", zoom, ...over }).toString()}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/tasks" className="link text-sm">← Tareas</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Planificación</h1>
            <p className="page-sub">Línea de tiempo de las tareas de un expediente, con sus dependencias.</p>
          </div>
          {caseId && (
            <div className="segmented">
              <Link href={q({ zoom: "day" })} aria-current={zoom === "day" ? "true" : undefined}>Días</Link>
              <Link href={q({ zoom: "week" })} aria-current={zoom === "week" ? "true" : undefined}>Semanas</Link>
            </div>
          )}
        </div>
      </div>

      {cases.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">Aún no hay expedientes abiertos con tareas que planificar.</p>
      ) : (
        <>
          <form method="get" className="card toolbar">
            <input type="hidden" name="zoom" value={zoom} />
            <label className="field min-w-72 flex-1">
              Expediente
              <select name="case" defaultValue={caseId} className={inputClass}>
                {cases.map((c) => (<option key={c.id} value={c.id}>{c.code} · {c.title}</option>))}
              </select>
            </label>
            <button type="submit" className="btn btn-secondary">Ver</button>
            {current && <Link href={`/cases/${current.id}`} className="link text-sm">Abrir expediente</Link>}
          </form>

          {gantt && gantt.rows.length > 0 ? (
            <>
              <GanttLegend />
              <GanttChart gantt={gantt} unit={unit} />
              <p className="text-xs text-muted">Las fechas salen del inicio y el vencimiento de cada tarea. Las flechas indican «no puede empezar hasta que termine». Define las dependencias en la ficha de cada tarea.</p>
            </>
          ) : (
            <p className="card p-8 text-center text-sm text-muted">Este expediente no tiene tareas con fechas. Añade inicio o vencimiento a sus tareas para verlas aquí.</p>
          )}

          {gantt && gantt.undated.length > 0 && (
            <section className="card flex flex-col gap-2 p-6">
              <h2 className="section-title">Sin fechas ({gantt.undated.length})</h2>
              <ul className="flex flex-col divide-y divide-slate-100 text-sm">
                {gantt.undated.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/tasks/${t.id}`} className="link">{t.title}</Link>
                    <span className="text-xs text-muted">{TASK_STATUS_LABELS[t.status as TaskStatus]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
