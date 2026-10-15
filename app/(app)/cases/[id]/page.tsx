import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCase } from "@/lib/modules/cases/queries";
import { archiveCase, changeCaseStatus, restoreCase } from "@/lib/modules/cases/actions";
import { PRIORITY_LABELS, type CaseEvent, type PipelineStatus, type Priority } from "@/lib/modules/cases/types";
import { fmtDate, fmtDateTime } from "@/lib/modules/format";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listTasks } from "@/lib/modules/tasks/queries";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { TaskTable } from "@/components/tasks/TaskTable";
import { getAlertThresholds, getCaseMinutes, listEntries } from "@/lib/modules/time/queries";
import { budgetStatus, formatHours, formatMinutes, formatMoney } from "@/lib/modules/time/calc";
import { listExpenses } from "@/lib/modules/expenses/queries";
import { KIND_LABELS, STATUS_LABELS, STATUS_STYLE } from "@/lib/modules/expenses/types";
import { StatusBadge } from "@/components/cases/StatusBadge";
import { inputClass } from "@/components/form-styles";

function eventText(e: CaseEvent, pipeline: PipelineStatus[], names: Map<string, string>) {
  const label = (k: unknown) => pipeline.find((s) => s.key === k)?.label ?? String(k ?? "—");
  switch (e.event_type) {
    case "created":
      return "Expediente creado";
    case "status_changed":
      return `Estado: ${label(e.payload.from)} → ${label(e.payload.to)}`;
    case "owner_changed":
      return `Responsable: ${names.get(String(e.payload.from)) ?? "—"} → ${names.get(String(e.payload.to)) ?? "—"}`;
    case "tasks_created":
      return `Tareas automáticas creadas: ${String(e.payload.count)} (fase ${label(e.payload.status)})`;
    case "archived":
      return "Archivado";
    case "restored":
      return "Restaurado";
    default:
      return e.event_type;
  }
}

export default async function CasePage({ params, searchParams }: PageProps<"/cases/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, role, tasks, minutesMap, thresholds, myEntries, caseExpenses] = await Promise.all([
    getCase(id),
    getCurrentRole(),
    listTasks({ caseId: id, state: "all", limit: 50 }),
    getCaseMinutes([id]),
    getAlertThresholds(),
    listEntries({ caseId: id, fromIso: "2000-01-01T00:00:00Z", toIso: "2100-01-01T00:00:00Z", limit: 8 }),
    listExpenses({ caseId: id, limit: 50 }),
  ]);
  if (!found) notFound();
  const { kase: c, contact, type, events, names } = found;
  const writable = role ? canWrite(role) : false;
  const status = type.pipeline.find((s) => s.key === c.status);

  const rows: [string, React.ReactNode][] = [
    ["Contacto", contact ? <Link key="c" href={`/contacts/${contact.id}`} className="link">{contact.name}</Link> : "—"],
    ["Tipo", type.name],
    ["Prioridad", PRIORITY_LABELS[c.priority as Priority]],
    ["Fecha límite", fmtDate(c.due_at)],
    ["Horas presupuestadas", c.budget_hours != null ? String(c.budget_hours) : "—"],
    ["Honorarios", c.fee_amount != null ? formatMoney(Number(c.fee_amount)) : "—"],
    ["Responsable", (c.owner_id && names.get(c.owner_id)) || "—"],
    ["Apertura", fmtDate(c.opened_at)],
    ["Cierre", fmtDate(c.closed_at)],
  ];

  const custom = type.custom_schema.map((f): [string, React.ReactNode] => {
    const v = c.custom_fields?.[f.key];
    if (f.type === "boolean") return [f.label, v ? "Sí" : "No"];
    if (f.type === "date") return [f.label, typeof v === "string" ? fmtDate(v) : "—"];
    return [f.label, v == null || v === "" ? "—" : String(v)];
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/cases" className="link text-sm">← Expedientes</Link>
          <h1 className="page-title mt-1">
            {c.code} · {c.title}
            {c.archived && <span className="ml-2 text-sm font-normal text-muted">(archivado)</span>}
          </h1>
          <div className="mt-2"><StatusBadge status={status} fallback={c.status} /></div>
        </div>
        {writable && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/cases/${c.id}/edit`} className="link">Editar</Link>
            {(role === "owner" || role === "admin") && <Link href={`/settings/audit?entity=cases&id=${c.id}`} className="link">Historial de cambios</Link>}
            {c.archived ? (
              <form action={restoreCase.bind(null, c.id)}><button type="submit" className="link">Restaurar</button></form>
            ) : (
              <form action={archiveCase.bind(null, c.id)}><button type="submit" className="link">Archivar</button></form>
            )}
          </div>
        )}
      </div>

      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}

      {writable && !c.archived && (
        <form action={changeCaseStatus.bind(null, c.id)} className="flex items-end gap-2">
          <label className="field">
            Cambiar estado
            <select name="status" defaultValue={c.status} className={`${inputClass} h-10`}>
              {type.pipeline.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </select>
          </label>
          <button type="submit" className="btn btn-secondary">Aplicar</button>
        </form>
      )}

      <dl className="dl-grid card max-w-2xl p-6">
        {[...rows, ...custom].map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Tareas</h2>
          <div className="flex items-center gap-4"><Link href={`/tasks/planning?case=${c.id}`} className="link text-sm">Ver Gantt</Link>{writable && <Link href={`/tasks/new?case=${c.id}`} className="link text-sm">Nueva tarea</Link>}</div>
        </div>
        <TaskTable rows={tasks.rows} names={tasks.names} back={`/cases/${c.id}`} canWrite={writable} showLinks={false} empty="Este expediente no tiene tareas." />
      </section>

      {(() => {
        const logged = minutesMap.get(id) ?? 0;
        const st = budgetStatus(logged, c.budget_hours != null ? Number(c.budget_hours) : null, thresholds[0] ?? 80);
        const bar = st.level === "over" ? "bg-red-500" : st.level === "warn" ? "bg-amber-500" : "bg-emerald-500";
        return (
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Tiempo</h2>
              <Link href="/time" className="link text-sm">Imputar horas</Link>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">
                {formatHours(logged)} h
                {c.budget_hours != null && <span className="text-base font-normal text-muted"> de {c.budget_hours} h presupuestadas</span>}
              </p>
              {st.pct !== null && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-slate-200">
                    <span className={`block h-full ${bar}`} style={{ width: `${Math.min(100, st.pct)}%` }} />
                  </span>
                  <span className={`text-sm font-medium ${st.level === "over" ? "text-danger" : st.level === "warn" ? "text-amber-600" : "text-muted"}`}>
                    {Math.round(st.pct)}%{st.level === "over" ? " · presupuesto superado" : st.level === "warn" ? " · en riesgo" : ""}
                  </span>
                </div>
              )}
            </div>
            {myEntries.length > 0 && (
              <ul className="flex flex-col divide-y divide-slate-100 text-sm">
                {myEntries.map((e) => (
                  <li key={e.id} className="flex justify-between gap-4 py-2">
                    <span>{e.description || "Sin descripción"}</span>
                    <span className="shrink-0 text-muted">{fmtDate(e.started_at)} · {formatMinutes(e.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })()}

      {caseExpenses.rows.length > 0 && (
        <section className="card flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Gastos</h2>
            <Link href="/expenses" className="link text-sm">Registrar gasto</Link>
          </div>
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {caseExpenses.rows.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{KIND_LABELS[e.kind]}{e.description ? ` · ${e.description}` : ""} <span className="text-muted">({fmtDate(`${e.expense_date}T12:00:00Z`)}{caseExpenses.names.get(e.user_id) ? ` · ${caseExpenses.names.get(e.user_id)}` : ""})</span></span>
                <span className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[e.status]}`}>{STATUS_LABELS[e.status]}</span>
                  <span className="w-24 text-right font-medium tabular-nums">{formatMoney(e.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-right text-sm font-semibold">Total aprobado: {formatMoney(caseExpenses.rows.filter((e) => e.status === "approved" || e.status === "reimbursed").reduce((s, e) => s + e.amount, 0))}</p>
        </section>
      )}

      <DocumentsSection caseId={c.id} back={`/cases/${c.id}`} canWrite={writable} />

      <section className="card flex max-w-2xl flex-col gap-3 p-6">
        <h2 className="section-title">Historial</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 border-b border-zinc-100 pb-2">
              <span>{eventText(e, type.pipeline, names)}</span>
              <span className="shrink-0 text-muted">
                {(e.actor_id && names.get(e.actor_id)) || "Sistema"} · {fmtDateTime(e.created_at)}
              </span>
            </li>
          ))}
          {events.length === 0 && <li className="text-muted">Sin actividad.</li>}
        </ul>
      </section>
    </div>
  );
}
