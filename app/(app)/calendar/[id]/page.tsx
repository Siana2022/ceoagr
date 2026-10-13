import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listContactOptions } from "@/lib/modules/cases/queries";
import { listCaseOptions } from "@/lib/modules/tasks/queries";
import { getAppointment, listResources } from "@/lib/modules/agenda/queries";
import { deleteAppointment, setAppointmentStatus, updateAppointment } from "@/lib/modules/agenda/actions";
import { madridParts } from "@/lib/modules/format";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";

export default async function AppointmentPage({ params }: PageProps<"/calendar/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [appt, role, resources, contacts, cases] = await Promise.all([
    getAppointment(id),
    getCurrentRole(),
    listResources(true),
    listContactOptions(),
    listCaseOptions(),
  ]);
  if (!appt) notFound();
  const writable = role ? canWrite(role) : false;
  const date = madridParts(appt.starts_at).date;
  const backToWeek = `/calendar?date=${date}&view=week`;
  const quick = "rounded-[5px] border border-brand px-3 py-1.5 text-sm text-brand hover:bg-brand hover:text-white";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={backToWeek} className="text-sm underline">← Agenda</Link>
        <h1 className="mt-1 text-xl font-semibold">{appt.title}</h1>
      </div>

      {writable && (
        <div className="flex flex-wrap gap-2">
          {appt.status !== "confirmed" && (
            <form action={setAppointmentStatus.bind(null, id)}>
              <input type="hidden" name="status" value="confirmed" />
              <input type="hidden" name="back" value={`/calendar/${id}`} />
              <button type="submit" className={quick}>Confirmar</button>
            </form>
          )}
          {appt.status !== "cancelled" && (
            <form action={setAppointmentStatus.bind(null, id)}>
              <input type="hidden" name="status" value="cancelled" />
              <input type="hidden" name="back" value={`/calendar/${id}`} />
              <button type="submit" className={quick}>Cancelar cita</button>
            </form>
          )}
          {appt.status !== "no_show" && (
            <form action={setAppointmentStatus.bind(null, id)}>
              <input type="hidden" name="status" value="no_show" />
              <input type="hidden" name="back" value={`/calendar/${id}`} />
              <button type="submit" className={quick}>Marcar no-show</button>
            </form>
          )}
        </div>
      )}

      {writable ? (
        <AppointmentForm
          action={updateAppointment.bind(null, id)}
          resources={resources}
          contacts={contacts}
          cases={cases}
          appointment={appt}
          cancelHref={backToWeek}
          submitLabel="Guardar cambios"
        />
      ) : (
        <p className="text-sm">{appt.notes || "Sin notas."}</p>
      )}

      {writable && (
        <form action={deleteAppointment.bind(null, id)}>
          <button type="submit" className="text-sm text-red-600 underline">Eliminar cita</button>
        </form>
      )}
    </div>
  );
}
