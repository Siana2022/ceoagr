import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { getAutomation } from "@/lib/modules/automations/queries";
import { updateAutomation } from "@/lib/modules/automations/actions";
import { AutomationForm } from "@/components/automations/AutomationForm";

export default async function EditAutomationPage({ params }: PageProps<"/settings/automations/[id]">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [automation, types] = await Promise.all([getAutomation(id), listCaseTypes(true)]);
  if (!automation) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings/automations" className="link text-sm">← Automatizaciones</Link>
        <h1 className="page-title mt-1">Editar automatización</h1>
      </div>
      <AutomationForm action={updateAutomation.bind(null, id)} caseTypes={types} automation={automation} submitLabel="Guardar cambios" />
    </div>
  );
}
