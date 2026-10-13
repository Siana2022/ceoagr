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
    case "archived":
      return "Archivado";
    case "restored":
      return "Restaurado";
    default:
      return e.event_type;
  }
}

export default async function CasePage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, role, tasks] = await Promise.all([
    getCase(id),
    getCurrentRole(),
    listTasks({ caseId: id, state: "all", limit: 50 }),
  ]);
  if (!found) notFound();
  const { kase: c, contact, type, events, names } = found;
  const writable = role ? canWrite(role) : false;
  const status = type.pipeline.find((s) => s.key === c.status);

  const rows: [string, React.ReactNode][] = [
    ["Contacto", contact ? <Link key="c" href={`/contacts/${contact.id}`} className="text-brand underline">{contact.name}</Link> : "—"],
    ["Tipo", type.name],
    ["Prioridad", PRIORITY_LABELS[c.priority as Priority]],
    ["Fecha límite", fmtDate(c.due_at)],
    ["Horas presupuestadas", c.budget_hours != null ? String(c.budget_hours) : "—"],
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
          <Link href="/cases" className="text-sm underline">← Expedientes</Link>
          <h1 className="mt-1 text-xl font-semibold">
            {c.code} · {c.title}
            {c.archived && <span className="ml-2 text-sm font-normal text-zinc-500">(archivado)</span>}
          </h1>
          <div className="mt-2"><StatusBadge status={status} fallback={c.status} /></div>
        </div>
        {writable && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/cases/${c.id}/edit`} className="underline">Editar</Link>
            {c.archived ? (
              <form action={restoreCase.bind(null, c.id)}><button type="submit" className="underline">Restaurar</button></form>
            ) : (
              <form action={archiveCase.bind(null, c.id)}><button type="submit" className="underline">Archivar</button></form>
            )}
          </div>
        )}
      </div>

      {writable && !c.archived && (
        <form action={changeCaseStatus.bind(null, c.id)} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Cambiar estado
            <select name="status" defaultValue={c.status} className={`${inputClass} h-10`}>
              {type.pipeline.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-[5px] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand hover:text-white">Aplicar</button>
        </form>
      )}

      <dl className="grid max-w-2xl grid-cols-[12rem_1fr] gap-x-4 gap-y-2 text-sm">
        {[...rows, ...custom].map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tareas</h2>
          {writable && <Link href={`/tasks/new?case=${c.id}`} className="text-sm text-brand underline">Nueva tarea</Link>}
        </div>
        <TaskTable rows={tasks.rows} names={tasks.names} back={`/cases/${c.id}`} canWrite={writable} showLinks={false} empty="Este expediente no tiene tareas." />
      </section>

      <DocumentsSection caseId={c.id} back={`/cases/${c.id}`} canWrite={writable} />

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-semibold">Historial</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 border-b border-zinc-100 pb-2">
              <span>{eventText(e, type.pipeline, names)}</span>
              <span className="shrink-0 text-zinc-500">
                {(e.actor_id && names.get(e.actor_id)) || "Sistema"} · {fmtDateTime(e.created_at)}
              </span>
            </li>
          ))}
          {events.length === 0 && <li className="text-zinc-500">Sin actividad.</li>}
        </ul>
      </section>
    </div>
  );
}
