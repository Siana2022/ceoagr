import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { getCaseType } from "@/lib/modules/cases/queries";
import { getTaskTemplate } from "@/lib/modules/task-templates/queries";
import { updateTaskTemplate } from "@/lib/modules/task-templates/actions";
import { TaskTemplateFields } from "@/components/cases/TaskTemplateFields";

export default async function EditTaskTemplatePage({
  params,
  searchParams,
}: PageProps<"/settings/case-types/[id]/tasks/[templateId]">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const [{ id, templateId }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(templateId).success) notFound();

  const [type, template] = await Promise.all([getCaseType(id), getTaskTemplate(templateId)]);
  if (!type || !template || template.case_type_id !== id) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/settings/case-types/${id}/tasks`} className="link text-sm">← Tareas automáticas</Link>
        <h1 className="page-title mt-1">Editar tarea automática</h1>
      </div>
      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}
      <form action={updateTaskTemplate.bind(null, id, templateId)} className="card flex max-w-2xl flex-col gap-4 p-6">
        <TaskTemplateFields pipeline={type.pipeline} template={template} />
        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary">Guardar cambios</button>
          <Link href={`/settings/case-types/${id}/tasks`} className="link text-sm">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
