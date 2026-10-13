import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContact } from "@/lib/modules/contacts/queries";
import { archiveContact, restoreContact } from "@/lib/modules/contacts/actions";
import { CONTACT_KIND_LABELS } from "@/lib/modules/contacts/types";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listCases, listCaseTypes } from "@/lib/modules/cases/queries";
import { listTasks } from "@/lib/modules/tasks/queries";
import { listContactAppointments } from "@/lib/modules/agenda/queries";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/modules/agenda/types";
import { PRIORITY_LABELS, type Priority } from "@/lib/modules/cases/types";
import { fmtDate, fmtDateTime } from "@/lib/modules/format";
import { TaskTable } from "@/components/tasks/TaskTable";
import { StatusBadge } from "@/components/cases/StatusBadge";
import { DocumentsSection } from "@/components/documents/DocumentsSection";

const TABS = [
  { key: "summary", label: "Resumen" },
  { key: "cases", label: "Expedientes" },
  { key: "tasks", label: "Tareas" },
  { key: "agenda", label: "Agenda" },
  { key: "documents", label: "Documentos" },
];
const FUTURE_TABS = ["Comunicaciones", "Tiempo"];

export default async function ContactPage({ params, searchParams }: PageProps<"/contacts/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "summary";
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, role] = await Promise.all([getContact(id), getCurrentRole()]);
  if (!found) notFound();

  const [caseTypes, cases, tasks, appointments] = await Promise.all([
    tab === "cases" ? listCaseTypes(true) : Promise.resolve([]),
    tab === "cases" ? listCases({ contactId: id, archived: false, all: true }) : Promise.resolve(null),
    tab === "tasks" ? listTasks({ contactId: id, state: "all", limit: 50 }) : Promise.resolve(null),
    tab === "agenda" ? listContactAppointments(id) : Promise.resolve([]),
  ]);
  const typeById = new Map(caseTypes.map((t) => [t.id, t]));
  const { contact: c, ownerName } = found;
  const writable = role ? canWrite(role) : false;

  const addr = [c.address.street, c.address.postal_code, c.address.city, c.address.province, c.address.country]
    .filter(Boolean)
    .join(", ");

  const rows: [string, string | null][] = [
    ["Tipo", CONTACT_KIND_LABELS[c.kind]],
    ["Razón social", c.legal_name],
    ["NIF / CIF", c.tax_id],
    ["Email", c.email],
    ["Teléfono", c.phone],
    ["Móvil", c.mobile],
    ["Dirección", addr || null],
    ["Origen", c.source],
    ["Responsable", ownerName],
    ["Alta", new Date(c.created_at).toLocaleDateString("es-ES")],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/contacts" className="text-sm underline">← Contactos</Link>
          <h1 className="mt-1 text-xl font-semibold">
            {c.name}
            {c.archived && <span className="ml-2 text-sm font-normal text-zinc-500">(archivado)</span>}
          </h1>
        </div>
        {writable && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/contacts/${c.id}/edit`} className="underline">Editar</Link>
            {c.archived ? (
              <form action={restoreContact.bind(null, c.id)}>
                <button type="submit" className="underline">Restaurar</button>
              </form>
            ) : (
              <form action={archiveContact.bind(null, c.id)}>
                <button type="submit" className="underline">Archivar</button>
              </form>
            )}
          </div>
        )}
      </div>

      <nav aria-label="Secciones del contacto" className="flex flex-wrap gap-2 border-b border-zinc-200 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "summary" ? `/contacts/${c.id}` : `/contacts/${c.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={tab === t.key ? "border-b-2 border-brand px-3 py-2 font-medium text-brand" : "px-3 py-2 hover:underline"}
          >
            {t.label}
          </Link>
        ))}
        {FUTURE_TABS.map((t) => (
          <span key={t} aria-disabled="true" className="px-3 py-2 text-zinc-400">{t}</span>
        ))}
      </nav>

      {tab === "summary" && (
        <dl className="grid max-w-2xl grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-zinc-500">{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
          <dt className="text-zinc-500">Etiquetas</dt>
          <dd>{c.tags.length ? c.tags.join(", ") : "—"}</dd>
        </dl>
      )}

      {tab === "cases" && cases && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Expedientes</h2>
            {writable && <Link href={`/cases/new?contact=${c.id}`} className="text-sm text-brand underline">Nuevo expediente</Link>}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200">
              <tr>
                <th className="py-2 pr-4 font-medium">Código</th>
                <th className="py-2 pr-4 font-medium">Título</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Prioridad</th>
                <th className="py-2 font-medium">Vence</th>
              </tr>
            </thead>
            <tbody>
              {cases.rows.map((k) => (
                <tr key={k.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4"><Link href={`/cases/${k.id}`} className="font-medium text-brand underline">{k.code}</Link></td>
                  <td className="py-2 pr-4">{k.title}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={typeById.get(k.case_type_id)?.pipeline.find((p) => p.key === k.status)} fallback={k.status} />
                  </td>
                  <td className="py-2 pr-4">{PRIORITY_LABELS[k.priority as Priority]}</td>
                  <td className="py-2">{fmtDate(k.due_at)}</td>
                </tr>
              ))}
              {cases.rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-zinc-500">Este contacto no tiene expedientes.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {tab === "tasks" && tasks && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tareas</h2>
            {writable && <Link href={`/tasks/new?contact=${c.id}`} className="text-sm text-brand underline">Nueva tarea</Link>}
          </div>
          <TaskTable rows={tasks.rows} names={tasks.names} back={`/contacts/${c.id}?tab=tasks`} canWrite={writable} showLinks={false} empty="Este contacto no tiene tareas." />
        </section>
      )}

      {tab === "agenda" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Citas</h2>
            {writable && <Link href={`/calendar/new?contact=${c.id}`} className="text-sm text-brand underline">Nueva cita</Link>}
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                <Link href={`/calendar/${a.id}`} className="font-medium text-brand underline">{a.title}</Link>
                <span className="text-zinc-500">
                  {fmtDateTime(a.starts_at)} · {a.resources?.name} · {APPOINTMENT_STATUS_LABELS[a.status]}
                </span>
              </li>
            ))}
            {appointments.length === 0 && <li className="text-zinc-500">Este contacto no tiene citas.</li>}
          </ul>
        </section>
      )}

      {tab === "documents" && (
        <DocumentsSection contactId={c.id} back={`/contacts/${c.id}?tab=documents`} canWrite={writable} />
      )}
    </div>
  );
}
