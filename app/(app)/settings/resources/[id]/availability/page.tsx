import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { getResource, listAvailabilityExceptions, listAvailabilityRules } from "@/lib/modules/agenda/queries";
import {
  addAvailabilityException,
  addAvailabilityRule,
  deleteAvailabilityException,
  deleteAvailabilityRule,
} from "@/lib/modules/agenda/actions";
import { WEEKDAY_LABELS } from "@/lib/modules/agenda/types";
import { fmtDate, todayMadrid } from "@/lib/modules/format";

export default async function ResourceAvailabilityPage({ params, searchParams }: PageProps<"/settings/resources/[id]/availability">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [sp, resource, rules, exceptions] = await Promise.all([
    searchParams,
    getResource(id),
    listAvailabilityRules(id),
    listAvailabilityExceptions(id),
  ]);
  if (!resource) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/settings/resources" className="link text-sm">← Recursos</Link>
        <h1 className="page-title mt-1">Horarios de {resource.name}</h1>
        <p className="page-sub">
          Define en qué días y horas se puede reservar este recurso desde la página pública. Fuera de estos horarios, o en los días bloqueados, no aparecerá ningún hueco libre.
        </p>
        {!resource.public_booking && (
          <p className="alert-error mt-3 max-w-xl">
            Este recurso aún no es «Reservable online». Actívalo en <Link href="/settings/resources" className="link">Recursos</Link> para que estos horarios tengan efecto.
          </p>
        )}
      </div>

      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Horario semanal</h2>
        <div className="table-card max-w-xl">
          <table>
            <thead><tr><th>Día</th><th>Desde</th><th>Hasta</th><th /></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{WEEKDAY_LABELS[r.weekday]}</td>
                  <td>{r.start_time.slice(0, 5)}</td>
                  <td>{r.end_time.slice(0, 5)}</td>
                  <td className="text-right">
                    <form action={deleteAvailabilityRule.bind(null, id, r.id)}><button type="submit" className="link-danger text-sm">Quitar</button></form>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">Sin horarios: no se puede reservar ningún día.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={addAvailabilityRule.bind(null, id)} className="card flex max-w-xl flex-wrap items-end gap-3 p-4">
          <label className="field">
            Día
            <select name="weekday" defaultValue="1" className="input">
              {WEEKDAY_LABELS.map((l, i) => (<option key={l} value={i}>{l}</option>))}
            </select>
          </label>
          <label className="field">Desde<input type="time" name="start_time" defaultValue="09:00" required className="input" /></label>
          <label className="field">Hasta<input type="time" name="end_time" defaultValue="18:00" required className="input" /></label>
          <button type="submit" className="btn btn-secondary">Añadir</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Días bloqueados (festivos, vacaciones…)</h2>
        <div className="table-card max-w-xl">
          <table>
            <thead><tr><th>Fecha</th><th>Motivo</th><th /></tr></thead>
            <tbody>
              {exceptions.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(`${e.date}T12:00:00Z`)}</td>
                  <td>{e.reason ?? "—"}</td>
                  <td className="text-right">
                    <form action={deleteAvailabilityException.bind(null, id, e.id)}><button type="submit" className="link-danger text-sm">Quitar</button></form>
                  </td>
                </tr>
              ))}
              {exceptions.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted">Sin días bloqueados.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={addAvailabilityException.bind(null, id)} className="card flex max-w-xl flex-wrap items-end gap-3 p-4">
          <label className="field">Fecha<input type="date" name="date" required min={todayMadrid()} className="input" /></label>
          <label className="field">Motivo (opcional)<input name="reason" maxLength={200} className="input" placeholder="Ej.: Vacaciones" /></label>
          <button type="submit" className="btn btn-secondary">Bloquear día</button>
        </form>
      </section>
    </div>
  );
}
