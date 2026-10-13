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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200">
          <tr>
            <th className="w-10 py-2" />
            <th className="py-2 pr-4 font-medium">Tarea</th>
            {showLinks && <th className="py-2 pr-4 font-medium">Expediente / Contacto</th>}
            <th className="py-2 pr-4 font-medium">Estado</th>
            <th className="py-2 pr-4 font-medium">Prioridad</th>
            <th className="py-2 pr-4 font-medium">Vence</th>
            <th className="py-2 font-medium">Asignada a</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const done = t.status === "done";
            const overdue = !!t.due_at && t.due_at.slice(0, 10) < today && (t.status === "todo" || t.status === "in_progress");
            return (
              <tr key={t.id} className="border-b border-zinc-100">
                <td className="py-2">
                  {canWrite && (
                    <form action={setTaskStatus.bind(null, t.id)}>
                      <input type="hidden" name="status" value={done ? "todo" : "done"} />
                      <input type="hidden" name="back" value={back} />
                      <button
                        type="submit"
                        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
                        className={`h-5 w-5 rounded border ${done ? "border-brand bg-brand text-white" : "border-zinc-400"} text-xs leading-none`}
                      >
                        {done ? "✓" : ""}
                      </button>
                    </form>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <Link href={`/tasks/${t.id}`} className={`font-medium text-brand underline ${done ? "line-through opacity-60" : ""}`}>
                    {t.title}
                  </Link>
                </td>
                {showLinks && (
                  <td className="py-2 pr-4">
                    {t.case_id && t.cases ? (
                      <Link href={`/cases/${t.case_id}`} className="underline">{t.cases.code}</Link>
                    ) : t.contact_id && t.contacts ? (
                      <Link href={`/contacts/${t.contact_id}`} className="underline">{t.contacts.name}</Link>
                    ) : "—"}
                  </td>
                )}
                <td className="py-2 pr-4">{TASK_STATUS_LABELS[t.status as TaskStatus]}</td>
                <td className="py-2 pr-4">{PRIORITY_LABELS[t.priority as Priority]}</td>
                <td className={`py-2 pr-4 ${overdue ? "font-medium text-red-600" : ""}`}>
                  {fmtDate(t.due_at)}{overdue ? " · vencida" : ""}
                </td>
                <td className="py-2">{(t.assignee_id && names.get(t.assignee_id)) || "—"}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-zinc-500">{empty ?? "No hay tareas."}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
