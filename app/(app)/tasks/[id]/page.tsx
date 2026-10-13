import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listContactOptions } from "@/lib/modules/cases/queries";
import { getTask, listCaseOptions } from "@/lib/modules/tasks/queries";
import {
  addChecklistItem,
  addSubtask,
  deleteChecklistItem,
  deleteTask,
  setTaskStatus,
  toggleChecklistItem,
  updateTask,
} from "@/lib/modules/tasks/actions";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/modules/tasks/types";
import { fmtDate } from "@/lib/modules/format";
import { TaskForm } from "@/components/tasks/TaskForm";
import { inputClass } from "@/components/form-styles";

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, role, members, cases, contacts] = await Promise.all([
    getTask(id),
    getCurrentRole(),
    listMembers(),
    listCaseOptions(),
    listContactOptions(),
  ]);
  if (!found) notFound();
  const { task, kase, contact, parent, subtasks, checklist, names } = found;
  const writable = role ? canWrite(role) : false;
  const doneItems = checklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={parent ? `/tasks/${parent.id}` : "/tasks"} className="link text-sm">
          ← {parent ? parent.title : "Tareas"}
        </Link>
        <h1 className="page-title mt-1">{task.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {TASK_STATUS_LABELS[task.status as TaskStatus]}
          {task.due_at ? ` · vence ${fmtDate(task.due_at)}` : ""}
          {kase && <> · <Link href={`/cases/${kase.id}`} className="link">{kase.code}</Link></>}
          {contact && <> · <Link href={`/contacts/${contact.id}`} className="link">{contact.name}</Link></>}
        </p>
      </div>

      {writable ? (
        <TaskForm
          action={updateTask.bind(null, id)}
          members={members}
          cases={cases}
          contacts={contacts}
          task={task}
          cancelHref="/tasks"
          submitLabel="Guardar cambios"
        />
      ) : (
        <p className="max-w-2xl whitespace-pre-wrap text-sm">{task.description || "Sin descripción."}</p>
      )}

      <section className="card flex max-w-2xl flex-col gap-3 p-6">
        <h2 className="section-title">
          Checklist {checklist.length > 0 && <span className="text-sm font-normal text-muted">({doneItems}/{checklist.length})</span>}
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <form action={toggleChecklistItem.bind(null, id, c.id, !c.done)}>
                <button
                  type="submit"
                  disabled={!writable}
                  aria-label={c.done ? "Desmarcar" : "Marcar"}
                  className={`check ${c.done ? "check-on" : ""}`}
                >
                  {c.done ? "✓" : ""}
                </button>
              </form>
              <span className={c.done ? "line-through opacity-60" : ""}>{c.label}</span>
              {writable && (
                <form action={deleteChecklistItem.bind(null, id, c.id)} className="ml-auto">
                  <button type="submit" className="link text-xs">Quitar</button>
                </form>
              )}
            </li>
          ))}
          {checklist.length === 0 && <li className="text-muted">Sin elementos.</li>}
        </ul>
        {writable && (
          <form action={addChecklistItem.bind(null, id)} className="flex gap-2">
            <input name="label" required placeholder="Nuevo elemento" className={`${inputClass} h-10`} />
            <button type="submit" className="btn btn-secondary">Añadir</button>
          </form>
        )}
      </section>

      {!task.parent_task_id && (
        <section className="card flex max-w-2xl flex-col gap-3 p-6">
          <h2 className="section-title">Subtareas</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                {writable && (
                  <form action={setTaskStatus.bind(null, s.id)}>
                    <input type="hidden" name="status" value={s.status === "done" ? "todo" : "done"} />
                    <input type="hidden" name="back" value={`/tasks/${id}`} />
                    <button
                      type="submit"
                      aria-label={s.status === "done" ? "Marcar como pendiente" : "Marcar como hecha"}
                      className={`check ${s.status === "done" ? "check-on" : ""}`}
                    >
                      {s.status === "done" ? "✓" : ""}
                    </button>
                  </form>
                )}
                <Link href={`/tasks/${s.id}`} className={`link ${s.status === "done" ? "line-through opacity-60" : ""}`}>{s.title}</Link>
                <span className="ml-auto text-muted">
                  {(s.assignee_id && names.get(s.assignee_id)) || ""} {s.due_at ? `· ${fmtDate(s.due_at)}` : ""}
                </span>
              </li>
            ))}
            {subtasks.length === 0 && <li className="text-muted">Sin subtareas.</li>}
          </ul>
          {writable && (
            <form action={addSubtask.bind(null, id)} className="flex gap-2">
              <input name="title" required placeholder="Nueva subtarea" className={`${inputClass} h-10`} />
              <button type="submit" className="btn btn-secondary">Añadir</button>
            </form>
          )}
        </section>
      )}

      {writable && (
        <form action={deleteTask.bind(null, id)}>
          <input type="hidden" name="back" value={parent ? `/tasks/${parent.id}` : "/tasks"} />
          <button type="submit" className="link-danger text-sm">Eliminar tarea</button>
        </form>
      )}
    </div>
  );
}
