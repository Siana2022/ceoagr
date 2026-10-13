import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { getTemplate } from "@/lib/modules/documents/queries";
import { updateTemplate } from "@/lib/modules/documents/actions";
import { TemplateForm } from "@/components/documents/TemplateForm";

export default async function EditTemplatePage({ params }: PageProps<"/settings/templates/[id]">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [template, types] = await Promise.all([getTemplate(id), listCaseTypes()]);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Editar plantilla: {template.name}</h1>
      <TemplateForm action={updateTemplate.bind(null, id)} caseTypes={types} template={template} submitLabel="Guardar cambios" />
    </div>
  );
}
