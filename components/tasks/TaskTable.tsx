import Link from "next/link";
import { fmtDate } from "@/lib/modules/format";
import { PRIORITY_LABELS, type Priority } from "@/lib/modules/cases/types";
import { setTaskStatus } from "@/lib/modules/tasks/actions";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/modules/tasks/types";
import type { TaskListItem } from "@/lib/modules/tasks/queries";

type Props = {
  rows: TaskListItem[];
  names: Map<string, string>;
  back: string;
  canWrite: boolean;
  showLinks?: boolean;
  empty?: string;
};

export function TaskTable({ rows, names, back, canWrite, showLinks = true, empty }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th className="w-10" />
            <th>Tarea</th>
            {showLinks && <th>Expediente / Contacto</th>}
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Vence</th>
            <th>Asignada a</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const done = t.status === "done";
            const overdue = !!t.due_at && t.due_at.slice(0, 10) < today && (t.status === "todo" || t.status === "in_progress");
            return (
              <tr key={t.id}>
                <td>
                  {canWrite && (
                    <form action={setTaskStatus.bind(null, t.id)}>
                      <input type="hidden" name="status" value={done ? "todo" : "done"} />
                      <input type="hidden" name="back" value={back} />
                      <button
                        type="submit"
                        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
                        className={`check ${done ? "check-on" : ""}`}
                      >
                        {done ? "✓" : ""}
                      </button>
                    </form>
                  )}
                </td>
                <td>
                  <Link href={`/tasks/${t.id}`} className={`link ${done ? "line-through opacity-60" : ""}`}>
                    {t.title}
                  </Link>
                </td>
                {showLinks && (
                  <td>
                    {t.case_id && t.cases ? (
                      <Link href={`/cases/${t.case_id}`} className="link">{t.cases.code}</Link>
                    ) : t.contact_id && t.contacts ? (
                      <Link href={`/contacts/${t.contact_id}`} className="link">{t.contacts.name}</Link>
                    ) : "—"}
                  </td>
                )}
                <td>{TASK_STATUS_LABELS[t.status as TaskStatus]}</td>
                <td>{PRIORITY_LABELS[t.priority as Priority]}</td>
                <td className={`py-2 pr-4 ${overdue ? "font-medium text-red-600" : ""}`}>
                  {fmtDate(t.due_at)}{overdue ? " · vencida" : ""}
                </td>
                <td>{(t.assignee_id && names.get(t.assignee_id)) || "—"}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted">{empty ?? "No hay tareas."}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
