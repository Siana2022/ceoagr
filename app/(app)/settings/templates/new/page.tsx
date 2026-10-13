import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { createTemplate } from "@/lib/modules/documents/actions";
import { TemplateForm } from "@/components/documents/TemplateForm";

export default async function NewTemplatePage() {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const types = await listCaseTypes();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Nueva plantilla</h1>
      <TemplateForm action={createTemplate} caseTypes={types} submitLabel="Crear plantilla" />
    </div>
  );
}
