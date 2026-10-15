import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { getTemplate } from "@/lib/modules/documents/queries";
import { TemplateForm } from "@/components/documents/TemplateForm";

export default async function EditTemplatePage({ params }: PageProps<"/settings/templates/[id]">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings/templates" className="link text-sm">← Plantillas</Link>
        <h1 className="page-title mt-1">Editar plantilla</h1>
      </div>
      <TemplateForm template={template} />
    </div>
  );
}
