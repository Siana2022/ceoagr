import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listContactOptions } from "@/lib/modules/cases/queries";
import { getUserId, listCaseOptions } from "@/lib/modules/tasks/queries";
import { createTask } from "@/lib/modules/tasks/actions";
import { TaskForm } from "@/components/tasks/TaskForm";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const uuid = (v: string | undefined) => (z.uuid().safeParse(v).success ? v : undefined);

export default async function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect("/tasks");

  const sp = await searchParams;
  const caseId = uuid(first(sp.case));
  const contactId = uuid(first(sp.contact));
  const [members, cases, contacts, uid] = await Promise.all([
    listMembers(),
    listCaseOptions(),
    listContactOptions(),
    getUserId(),
  ]);
  const back = caseId ? `/cases/${caseId}` : contactId ? `/contacts/${contactId}` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nueva tarea</h1>
      <TaskForm
        action={createTask}
        members={members}
        cases={cases}
        contacts={contacts}
        preset={{ case_id: caseId, contact_id: contactId, assignee_id: uid ?? undefined }}
        back={back}
        cancelHref={back ?? "/tasks"}
        submitLabel="Crear tarea"
      />
    </div>
  );
}
