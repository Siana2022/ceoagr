import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listContactOptions } from "@/lib/modules/cases/queries";
import { listCaseOptions } from "@/lib/modules/tasks/queries";
import { listResources } from "@/lib/modules/agenda/queries";
import { createAppointment } from "@/lib/modules/agenda/actions";
import { isDateString, todayMadrid } from "@/lib/modules/format";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const uuid = (v: string | undefined) => (z.uuid().safeParse(v).success ? v : undefined);

export default async function NewAppointmentPage({ searchParams }: PageProps<"/calendar/new">) {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect("/calendar");

  const sp = await searchParams;
  const dateParam = first(sp.date);
  const contactId = uuid(first(sp.contact));
  const caseId = uuid(first(sp.case));
  const [resources, contacts, cases] = await Promise.all([listResources(), listContactOptions(), listCaseOptions()]);

  if (resources.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Nueva cita</h1>
        <p className="text-sm">
          Primero hay que crear un recurso en <Link href="/settings/resources" className="underline">Ajustes → Recursos</Link>.
        </p>
      </div>
    );
  }

  const back = caseId ? `/cases/${caseId}` : contactId ? `/contacts/${contactId}` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nueva cita</h1>
      <AppointmentForm
        action={createAppointment}
        resources={resources}
        contacts={contacts}
        cases={cases}
        preset={{
          date: isDateString(dateParam) ? dateParam : todayMadrid(),
          resource_id: uuid(first(sp.resource)),
          contact_id: contactId,
          case_id: caseId,
        }}
        back={back}
        cancelHref={back ?? "/calendar"}
        submitLabel="Crear cita"
      />
    </div>
  );
}
