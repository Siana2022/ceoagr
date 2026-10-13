import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listContactOptions } from "@/lib/modules/cases/queries";
import { createOpportunity } from "@/lib/modules/opportunities/actions";
import { OpportunityForm } from "@/components/opportunities/OpportunityForm";

export default async function NewOpportunityPage({ searchParams }: PageProps<"/opportunities/new">) {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect("/opportunities");
  const sp = await searchParams;
  const c = Array.isArray(sp.contact) ? sp.contact[0] : sp.contact;
  const [contacts, members] = await Promise.all([listContactOptions(), isStaffRole(role) ? listMembers() : Promise.resolve(null)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Nueva oportunidad</h1>
      <OpportunityForm
        action={createOpportunity}
        contacts={contacts}
        members={members}
        presetContact={z.uuid().safeParse(c).success ? c : undefined}
        cancelHref="/opportunities"
        submitLabel="Crear oportunidad"
      />
    </div>
  );
}
