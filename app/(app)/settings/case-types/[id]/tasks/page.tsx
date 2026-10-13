import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { getCaseType } from "@/lib/modules/cases/queries";
import { listTaskTemplates } from "@/lib/modules/task-templates/queries";
import { createTaskTemplate, deleteTaskTemplate, setTaskTemplateActive } from "@/lib/modules/task-templates/actions";
import { ASSIGN_LABELS } from "@/lib/modules/task-templates/schema";
import { PRIORITY_LABELS } from "@/lib/modules/cases/types";
import { StatusBadge } from "@/components/cases/StatusBadge";
import { TaskTemplateFields } from "@/components/cases/TaskTemplateFields";

export default async function TaskTemplatesPage({
  params,
  searchParams,
}: PageProps<"/settings/case-types/[id]/tasks">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const [type, templates] = await Promise.all([getCaseType(id), listTaskTemplates(id)]);
  if (!type) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/settings/case-types/${id}`} className="link text-sm">← {type.name}</Link>
        <h1 className="page-title mt-1">Tareas automáticas por fase</h1>
        <p className="page-sub">
          Cuando un {type.label_singular.toLowerCase()} entra en una fase, se crean solas las tareas que definas aquí.
          Si vuelve a esa fase, no se duplican.
        </p>
      </div>

      {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}
      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}

      {type.pipeline.map((s) => {
        const list = templates.filter((t) => t.status_key === s.key);
        return (
          <section key={s.key} className="card flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="section-title flex items-center gap-3">
                <StatusBadge status={s} />
                <span className="text-sm font-normal text-muted">{list.length} tarea{list.length === 1 ? "" : "s"}</span>
              </h2>
            </div>

            <ul className="flex flex-col divide-y divide-slate-100">
              {list.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className={t.active ? "" : "opacity-50"}>
                    <Link href={`/settings/case-types/${id}/tasks/${t.id}`} className="link">{t.title}</Link>
                    <p className="text-xs text-muted">
                      {ASSIGN_LABELS[t.assign_to]} · {t.due_offset_days != null ? `plazo ${t.due_offset_days} d` : "sin plazo"} · {PRIORITY_LABELS[t.priority]}
                      {t.checklist.length > 0 && ` · checklist ${t.checklist.length}`}
                      {!t.active && " · desactivada"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <form action={setTaskTemplateActive.bind(null, id, t.id, !t.active)}>
                      <button type="submit" className="link text-sm">{t.active ? "Desactivar" : "Activar"}</button>
                    </form>
                    <form action={deleteTaskTemplate.bind(null, id, t.id)}>
                      <button type="submit" className="link-danger text-sm">Eliminar</button>
                    </form>
                  </div>
                </li>
              ))}
              {list.length === 0 && <li className="py-3 text-sm text-muted">Sin tareas automáticas en esta fase.</li>}
            </ul>

            <details className="rounded-xl bg-slate-50 p-4">
              <summary className="link cursor-pointer text-sm">+ Añadir tarea a esta fase</summary>
              <form action={createTaskTemplate.bind(null, id)} className="mt-4 flex flex-col gap-4">
                <TaskTemplateFields pipeline={type.pipeline} fixedStatus={s.key} />
                <div><button type="submit" className="btn btn-primary">Añadir tarea</button></div>
              </form>
            </details>
          </section>
        );
      })}
    </div>
  );
}
