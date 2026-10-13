import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { getCaseType } from "@/lib/modules/cases/queries";
import { updateCaseType } from "@/lib/modules/cases/actions";
import { CaseTypeForm } from "@/components/cases/CaseTypeForm";

export default async function EditCaseTypePage({ params }: PageProps<"/settings/case-types/[id]">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const type = await getCaseType(id);
  if (!type) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Editar tipo: {type.name}</h1>
        <Link href={`/settings/case-types/${id}/tasks`} className="btn btn-secondary">Tareas automáticas por fase</Link>
      </div>
      <CaseTypeForm action={updateCaseType.bind(null, id)} type={type} submitLabel="Guardar cambios" />
    </div>
  );
}
