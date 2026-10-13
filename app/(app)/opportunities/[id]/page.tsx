import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { getOpportunity } from "@/lib/modules/opportunities/queries";
import {
  archiveOpportunity, changeStage, convertToProject, createQuote, markLost, restoreOpportunity,
} from "@/lib/modules/opportunities/actions";
import { effectiveProbability, stageInfo } from "@/lib/modules/opportunities/calc";
import { OPEN_STAGES, QUOTE_STATUS_LABELS, STAGES, type Stage } from "@/lib/modules/opportunities/types";
import { formatMoney } from "@/lib/modules/time/calc";
import { fmtDate } from "@/lib/modules/format";
import { StatusBadge } from "@/components/cases/StatusBadge";

export default async function OpportunityPage({ params, searchParams }: PageProps<"/opportunities/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const [found, role, types] = await Promise.all([getOpportunity(id), getCurrentRole(), listCaseTypes()]);
  if (!found) notFound();

  const { opp, contact, kase, ownerName, quotes } = found;
  const writable = !!role && canWrite(role);
  const s = stageInfo(opp.stage);
  const open = OPEN_STAGES.includes(opp.stage as Stage);
  const hasAccepted = quotes.some((q) => q.status === "accepted");

  const rows: [string, React.ReactNode][] = [
    ["Cliente", contact ? <Link key="c" href={`/contacts/${contact.id}`} className="link">{contact.name}</Link> : "—"],
    ["Valor estimado", opp.expected_value != null ? formatMoney(opp.expected_value) : "—"],
    ["Probabilidad", `${effectiveProbability(opp)}%`],
    ["Cierre previsto", opp.expected_close ? fmtDate(`${opp.expected_close}T12:00:00Z`) : "—"],
    ["Responsable", ownerName ?? "—"],
    ["Origen", opp.source ?? "—"],
    ...(opp.stage === "lost" ? ([["Motivo de pérdida", opp.lost_reason ?? "—"]] as [string, React.ReactNode][]) : []),
    ...(kase ? ([["Proyecto", <Link key="k" href={`/cases/${kase.id}`} className="link">{kase.code}</Link>]] as [string, React.ReactNode][]) : []),
    ["Notas", opp.notes ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/opportunities" className="link text-sm">← Oportunidades</Link>
          <h1 className="page-title mt-1">
            {opp.title}
            {opp.archived && <span className="ml-2 text-sm font-normal text-muted">(archivada)</span>}
          </h1>
          <div className="mt-2"><StatusBadge status={{ key: s.key, label: s.label, color: s.color }} /></div>
        </div>
        {writable && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/opportunities/${id}/edit`} className="link">Editar</Link>
            {opp.archived ? (
              <form action={restoreOpportunity.bind(null, id)}><button type="submit" className="link">Restaurar</button></form>
            ) : (
              <form action={archiveOpportunity.bind(null, id)}><button type="submit" className="link">Archivar</button></form>
            )}
          </div>
        )}
      </div>

      {sp.error && <p role="alert" className="alert-error">No se pudo completar la acción. Revisa que haya un tipo de proyecto y los permisos.</p>}

      {writable && open && !opp.archived && (
        <div className="card flex flex-wrap items-end gap-6 p-5">
          <form action={changeStage.bind(null, id)} className="flex items-end gap-2">
            <label className="field">
              Cambiar fase
              <select name="stage" defaultValue={opp.stage} className="input w-52">
                {STAGES.filter((x) => OPEN_STAGES.includes(x.key)).map((x) => (<option key={x.key} value={x.key}>{x.label}</option>))}
              </select>
            </label>
            <button type="submit" className="btn btn-secondary">Aplicar</button>
          </form>

          <form action={convertToProject.bind(null, id)} className="flex items-end gap-2">
            <label className="field">
              Ganada → crear proyecto
              <select name="case_type_id" required className="input w-52">
                {types.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            </label>
            <button type="submit" disabled={types.length === 0} className="btn btn-primary">Convertir en proyecto</button>
          </form>

          <form action={markLost.bind(null, id)} className="flex items-end gap-2">
            <label className="field">
              Marcar como perdida
              <input name="lost_reason" required minLength={3} placeholder="Motivo" className="input w-52" />
            </label>
            <button type="submit" className="btn btn-secondary">Perdida</button>
          </form>
          {!hasAccepted && <p className="w-full text-xs text-muted">Consejo: acepta un presupuesto antes de convertir; sus horas y honorarios se cargarán en el proyecto.</p>}
        </div>
      )}

      <dl className="dl-grid card max-w-2xl p-6">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt>{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Presupuestos</h2>
          {writable && !opp.archived && (
            <form action={createQuote.bind(null, id)}><button type="submit" className="btn btn-secondary btn-sm">Nuevo presupuesto</button></form>
          )}
        </div>
        <div className="table-card">
          <table>
            <thead><tr><th>Número</th><th>Título</th><th>Estado</th><th>Fecha</th><th>Total</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td><Link href={`/quotes/${q.id}`} className="link">{q.number}</Link></td>
                  <td>{q.title}</td>
                  <td>{QUOTE_STATUS_LABELS[q.status]}</td>
                  <td>{fmtDate(`${q.issue_date}T12:00:00Z`)}</td>
                  <td className="tabular-nums">{formatMoney(q.total)}</td>
                </tr>
              ))}
              {quotes.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted">Todavía no hay presupuestos.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
