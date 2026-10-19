import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { createAutomation } from "@/lib/modules/automations/actions";
import { AutomationForm } from "@/components/automations/AutomationForm";

export default async function NewAutomationPage() {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const types = await listCaseTypes();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings/automations" className="link text-sm">← Automatizaciones</Link>
        <h1 className="page-title mt-1">Nueva automatización</h1>
      </div>
      <AutomationForm action={createAutomation} caseTypes={types} submitLabel="Crear automatización" />
    </div>
  );
}
