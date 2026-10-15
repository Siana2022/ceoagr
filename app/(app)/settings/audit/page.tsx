import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { AUDIT_PAGE_SIZE, listAudit } from "@/lib/modules/audit/queries";
import { ACTION_LABELS, ENTITY_LABELS, entityHref, summarize } from "@/lib/modules/audit/summary";
import { addDays, fmtDateTime, isDateString, madridToUtc } from "@/lib/modules/format";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ACTION_STYLE: Record<string, string> = {
  insert: "bg-emerald-100 text-emerald-700",
  update: "bg-sky-100 text-sky-700",
  delete: "bg-red-100 text-red-700",
  merge: "bg-violet-100 text-violet-700",
};

export default async function AuditPage({ searchParams }: PageProps<"/settings/audit">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const sp = await searchParams;

  const entity = Object.keys(ENTITY_LABELS).find((e) => e === first(sp.entity));
  const action = Object.keys(ACTION_LABELS).find((a) => a === first(sp.action));
  const actor = first(sp.user);
  const actorId = z.uuid().safeParse(actor).success ? actor : undefined;
  const entityId = z.uuid().safeParse(first(sp.id)).success ? first(sp.id) : undefined;
  const from = first(sp.from);
  const to = first(sp.to);
  const page = Number.parseInt(first(sp.page) ?? "1", 10) || 1;

  const [members, { rows, total, page: current, error }] = await Promise.all([
    listMembers(),
    listAudit({
      entity, action, actorId, entityId, page,
      fromIso: isDateString(from) ? madridToUtc(from, "00:00").toISOString() : undefined,
      toIso: isDateString(to) ? madridToUtc(addDays(to, 1), "00:00").toISOString() : undefined,
    }),
  ]);
  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const q = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { entity, action, user: actorId, id: entityId, from: isDateString(from) ? from : undefined, to: isDateString(to) ? to : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/settings/audit?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <h1 className="page-title mt-1">Registro de actividad</h1>
        <p className="page-sub">
          Quién creó, cambió o eliminó qué y cuándo. Se registran los cambios en contactos, expedientes, tareas, oportunidades, presupuestos, documentos, citas, horas y gastos.
          No se registran las consultas (quién miró qué).
        </p>
      </div>

      <form method="get" className="card toolbar">
        <label className="field">
          Qué
          <select name="entity" defaultValue={entity ?? ""} className="input w-44">
            <option value="">Todo</option>
            {Object.entries(ENTITY_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </label>
        <label className="field">
          Acción
          <select name="action" defaultValue={action ?? ""} className="input w-40">
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </label>
        <label className="field">
          Persona
          <select name="user" defaultValue={actorId ?? ""} className="input w-48">
            <option value="">Todas</option>
            {members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name}</option>))}
          </select>
        </label>
        <label className="field">Desde<input type="date" name="from" defaultValue={isDateString(from) ? from : ""} className="input" /></label>
        <label className="field">Hasta<input type="date" name="to" defaultValue={isDateString(to) ? to : ""} className="input" /></label>
        {entityId && <input type="hidden" name="id" value={entityId} />}
        <button type="submit" className="btn btn-secondary">Filtrar</button>
        {entityId && <Link href={q({ id: "" })} className="link text-sm">Quitar filtro del elemento</Link>}
      </form>

      {error && <p role="alert" className="alert-error">No se pudo cargar el registro.</p>}

      <div className="table-card">
        <table>
          <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const s = summarize(r.action, r.diff);
              const href = entityHref(r.entity, r.entity_id);
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums">{fmtDateTime(r.created_at)}</td>
                  <td>{(r.actor_id && names.get(r.actor_id)) || (r.actor_id ? "Usuario" : "Sistema")}</td>
                  <td>
                    <span className="font-medium">{ENTITY_LABELS[r.entity] ?? r.entity}</span>
                    {href && <> · <Link href={href} className="link text-xs">abrir</Link></>}
                    <span className="block text-xs">
                      <Link href={q({ entity: r.entity, id: r.entity_id, page: "1" })} className="link">historial de este elemento</Link>
                    </span>
                  </td>
                  <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLE[r.action] ?? "bg-slate-100 text-slate-700"}`}>{ACTION_LABELS[r.action] ?? r.action}</span></td>
                  <td className="text-sm">
                    {s.headline && <span className="font-medium">{s.headline}</span>}
                    {s.changes.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
                        {s.changes.map((c) => (
                          <li key={c.field}><span className="font-medium text-foreground">{c.field}:</span> {c.before} → {c.after}</li>
                        ))}
                        {s.more > 0 && <li>y {s.more} cambio(s) más</li>}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && <tr><td colSpan={5} className="py-10 text-center text-muted">No hay actividad con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>{total} registro{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-3">
          {current > 1 ? <Link href={q({ page: String(current - 1) })} className="link">Anterior</Link> : <span className="text-slate-400">Anterior</span>}
          <span>Página {current} de {pages}</span>
          {current < pages ? <Link href={q({ page: String(current + 1) })} className="link">Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
        </div>
      </div>
    </div>
  );
}
