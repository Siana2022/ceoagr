import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listContactOptions } from "@/lib/modules/cases/queries";
import { getOpportunity } from "@/lib/modules/opportunities/queries";
import { updateOpportunity } from "@/lib/modules/opportunities/actions";
import { OpportunityForm } from "@/components/opportunities/OpportunityForm";

export default async function EditOpportunityPage({ params }: PageProps<"/opportunities/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [found, role, contacts] = await Promise.all([getOpportunity(id), getCurrentRole(), listContactOptions()]);
  if (!found) notFound();
  const members = role && isStaffRole(role) ? await listMembers() : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Editar oportunidad</h1>
      <OpportunityForm
        action={updateOpportunity.bind(null, id)}
        contacts={contacts}
        members={members}
        opp={found.opp}
        cancelHref={`/opportunities/${id}`}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
