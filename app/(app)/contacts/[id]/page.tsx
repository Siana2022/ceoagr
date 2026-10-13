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
          <Link href="/contacts" className="link text-sm">← Contactos</Link>
          <h1 className="page-title mt-1">
            {c.name}
            {c.archived && <span className="ml-2 text-sm font-normal text-muted">(archivado)</span>}
          </h1>
        </div>
        {writable && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/contacts/${c.id}/edit`} className="link">Editar</Link>
            {c.archived ? (
              <form action={restoreContact.bind(null, c.id)}>
                <button type="submit" className="link">Restaurar</button>
              </form>
            ) : (
              <form action={archiveContact.bind(null, c.id)}>
                <button type="submit" className="link">Archivar</button>
              </form>
            )}
          </div>
        )}
      </div>

      <nav aria-label="Secciones del contacto" className="tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "summary" ? `/contacts/${c.id}` : `/contacts/${c.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className="tab"
          >
            {t.label}
          </Link>
        ))}
        {FUTURE_TABS.map((t) => (
          <span key={t} aria-disabled="true" className="tab cursor-not-allowed opacity-50">{t}</span>
        ))}
      </nav>

      {tab === "summary" && (
        <dl className="dl-grid card max-w-2xl p-6">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
          <dt className="text-muted">Etiquetas</dt>
          <dd>{c.tags.length ? c.tags.join(", ") : "—"}</dd>
        </dl>
      )}

      {tab === "cases" && cases && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Expedientes</h2>
            {writable && <Link href={`/cases/new?contact=${c.id}`} className="link text-sm">Nuevo expediente</Link>}
          </div>
          <div className="table-card"><table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Vence</th>
              </tr>
            </thead>
            <tbody>
              {cases.rows.map((k) => (
                <tr key={k.id}>
                  <td><Link href={`/cases/${k.id}`} className="link">{k.code}</Link></td>
                  <td>{k.title}</td>
                  <td>
                    <StatusBadge status={typeById.get(k.case_type_id)?.pipeline.find((p) => p.key === k.status)} fallback={k.status} />
                  </td>
                  <td>{PRIORITY_LABELS[k.priority as Priority]}</td>
                  <td>{fmtDate(k.due_at)}</td>
                </tr>
              ))}
              {cases.rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Este contacto no tiene expedientes.</td></tr>}
            </tbody>
          </table></div>
        </section>
      )}

      {tab === "tasks" && tasks && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Tareas</h2>
            {writable && <Link href={`/tasks/new?contact=${c.id}`} className="link text-sm">Nueva tarea</Link>}
          </div>
          <TaskTable rows={tasks.rows} names={tasks.names} back={`/contacts/${c.id}?tab=tasks`} canWrite={writable} showLinks={false} empty="Este contacto no tiene tareas." />
        </section>
      )}

      {tab === "agenda" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Citas</h2>
            {writable && <Link href={`/calendar/new?contact=${c.id}`} className="link text-sm">Nueva cita</Link>}
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                <Link href={`/calendar/${a.id}`} className="link">{a.title}</Link>
                <span className="text-muted">
                  {fmtDateTime(a.starts_at)} · {a.resources?.name} · {APPOINTMENT_STATUS_LABELS[a.status]}
                </span>
              </li>
            ))}
            {appointments.length === 0 && <li className="text-muted">Este contacto no tiene citas.</li>}
          </ul>
        </section>
      )}

      {tab === "documents" && (
        <DocumentsSection contactId={c.id} back={`/contacts/${c.id}?tab=documents`} canWrite={writable} />
      )}
    </div>
  );
}
