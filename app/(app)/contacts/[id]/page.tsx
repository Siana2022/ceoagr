import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContact, listContactShares, listRelations, RELATION_TYPES } from "@/lib/modules/contacts/queries";
import { listContactOptions } from "@/lib/modules/cases/queries";
import { listMembers } from "@/lib/modules/members";
import { getUserId } from "@/lib/modules/tasks/queries";
import { addRelation, archiveContact, deleteRelation, restoreContact, shareContact, unshareContact } from "@/lib/modules/contacts/actions";
import { CONTACT_KIND_LABELS } from "@/lib/modules/contacts/types";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { listCases, listCaseTypes } from "@/lib/modules/cases/queries";
import { listOpportunities } from "@/lib/modules/opportunities/queries";
import { stageInfo } from "@/lib/modules/opportunities/calc";
import { formatMoney } from "@/lib/modules/time/calc";
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
  { key: "relations", label: "Relaciones" },
  { key: "opps", label: "Oportunidades" },
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

  const uid = await getUserId();
  const canShare = !!role && canWrite(role) && (isStaffRole(role) || found.contact.owner_id === uid);
  const [relations, relationOptions, shares, members, caseTypes, cases, tasks, appointments, opps] = await Promise.all([
    tab === "relations" ? listRelations(id) : Promise.resolve([]),
    tab === "relations" ? listContactOptions() : Promise.resolve([]),
    tab === "summary" ? listContactShares(id) : Promise.resolve([]),
    tab === "summary" && canShare ? listMembers() : Promise.resolve([]),
    tab === "cases" ? listCaseTypes(true) : Promise.resolve([]),
    tab === "cases" ? listCases({ contactId: id, archived: false, all: true }) : Promise.resolve(null),
    tab === "tasks" ? listTasks({ contactId: id, state: "all", limit: 50 }) : Promise.resolve(null),
    tab === "agenda" ? listContactAppointments(id) : Promise.resolve([]),
    tab === "opps" ? listOpportunities({ contactId: id, limit: 50 }) : Promise.resolve(null),
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
            {(role === "owner" || role === "admin") && <Link href={`/settings/audit?entity=contacts&id=${c.id}`} className="link">Historial de cambios</Link>}
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

      {tab === "summary" && (shares.length > 0 || canShare) && (
        <section className="card flex max-w-2xl flex-col gap-4 p-6">
          <h2 className="section-title">Compartido con</h2>
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {shares.map((sh) => (
              <li key={sh.id} className="flex items-center justify-between gap-3 py-2">
                <span>{sh.name} <span className="text-muted">· {sh.permission === "edit" ? "puede editar" : "solo ver"}</span></span>
                {canShare && (
                  <form action={unshareContact.bind(null, c.id, sh.id)}><button type="submit" className="link-danger text-sm">Quitar</button></form>
                )}
              </li>
            ))}
            {shares.length === 0 && <li className="py-2 text-muted">Solo lo ven su responsable y quienes tienen permisos por rol.</li>}
          </ul>
          {canShare && (
            <form action={shareContact.bind(null, c.id)} className="flex flex-wrap items-end gap-3">
              <label className="field">
                Persona
                <select name="user_id" required className="input w-56">
                  {members.filter((m) => m.user_id !== c.owner_id && m.user_id !== uid).map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name}</option>))}
                </select>
              </label>
              <label className="field">
                Permiso
                <select name="permission" className="input w-36"><option value="view">Solo ver</option><option value="edit">Puede editar</option></select>
              </label>
              <button type="submit" className="btn btn-secondary">Compartir</button>
            </form>
          )}
        </section>
      )}

      {tab === "relations" && (
        <section className="flex flex-col gap-4">
          <h2 className="section-title">Relaciones con otros contactos</h2>
          {sp.error && <p role="alert" className="alert-error">No se pudo añadir la relación.</p>}
          <ul className="card flex max-w-2xl flex-col divide-y divide-slate-100">
            {relations.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span><span className="text-muted">{r.label}</span>{" "}<Link href={`/contacts/${r.otherId}`} className="link">{r.otherName}</Link></span>
                {writable && (
                  <form action={deleteRelation.bind(null, c.id, r.id)}><button type="submit" className="link-danger text-sm">Quitar</button></form>
                )}
              </li>
            ))}
            {relations.length === 0 && <li className="p-6 text-center text-sm text-muted">Este contacto no tiene relaciones.</li>}
          </ul>
          {writable && (
            <form action={addRelation.bind(null, c.id)} className="card flex max-w-2xl flex-wrap items-end gap-3 p-4">
              <label className="field">
                Relación
                <select name="type" className="input w-52">{RELATION_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}</select>
              </label>
              <label className="field">
                …o escribe otra
                <input name="custom_type" maxLength={60} className="input w-44" placeholder="Opcional" />
              </label>
              <label className="field min-w-56 flex-1">
                Contacto
                <select name="related" required className="input">
                  {relationOptions.filter((o) => o.id !== c.id).map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
                </select>
              </label>
              <button type="submit" className="btn btn-secondary">Añadir relación</button>
            </form>
          )}
        </section>
      )}

      {tab === "opps" && opps && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Oportunidades</h2>
            {writable && <Link href={`/opportunities/new?contact=${c.id}`} className="link text-sm">Nueva oportunidad</Link>}
          </div>
          <div className="table-card">
            <table>
              <thead><tr><th>Título</th><th>Fase</th><th>Valor</th></tr></thead>
              <tbody>
                {opps.rows.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/opportunities/${o.id}`} className="link">{o.title}</Link></td>
                    <td>{stageInfo(o.stage).label}</td>
                    <td className="tabular-nums">{o.expected_value != null ? formatMoney(o.expected_value) : "—"}</td>
                  </tr>
                ))}
                {opps.rows.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted">Este contacto no tiene oportunidades.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
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

      {tab === "documents" && typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}

      {tab === "documents" && (
        <DocumentsSection contactId={c.id} back={`/contacts/${c.id}?tab=documents`} canWrite={writable} />
      )}
    </div>
  );
}
