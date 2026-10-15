import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { TemplateForm } from "@/components/documents/TemplateForm";

export default async function NewTemplatePage() {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings/templates" className="link text-sm">← Plantillas</Link>
        <h1 className="page-title mt-1">Nueva plantilla</h1>
      </div>
      <TemplateForm />
    </div>
  );
}
