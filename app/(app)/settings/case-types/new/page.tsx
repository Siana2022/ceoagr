import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { createCaseType } from "@/lib/modules/cases/actions";
import { CaseTypeForm } from "@/components/cases/CaseTypeForm";

export default async function NewCaseTypePage() {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nuevo tipo de expediente</h1>
      <CaseTypeForm action={createCaseType} submitLabel="Crear tipo" />
    </div>
  );
}
