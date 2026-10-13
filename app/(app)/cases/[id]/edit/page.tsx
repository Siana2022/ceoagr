import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { getCase, listContactOptions } from "@/lib/modules/cases/queries";
import { updateCase } from "@/lib/modules/cases/actions";
import { CaseForm } from "@/components/cases/CaseForm";

export default async function EditCasePage({ params }: PageProps<"/cases/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, role, contacts] = await Promise.all([getCase(id), getCurrentRole(), listContactOptions()]);
  if (!found) notFound();
  const members = role && isStaffRole(role) ? await listMembers() : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Editar {found.kase.code}</h1>
      <CaseForm
        action={updateCase.bind(null, id)}
        type={found.type}
        contacts={contacts}
        members={members}
        kase={found.kase}
        cancelHref={`/cases/${id}`}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
