import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { getQuote } from "@/lib/modules/opportunities/queries";
import { listTemplates } from "@/lib/modules/documents/queries";
import {
  addQuoteLine, deleteQuoteLine, generateQuoteDocument, setQuoteStatus, updateQuote, updateQuoteLine,
} from "@/lib/modules/opportunities/actions";
import { quoteTotals } from "@/lib/modules/opportunities/calc";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/modules/opportunities/types";
import { formatMoney } from "@/lib/modules/time/calc";
import { fmtDate } from "@/lib/modules/format";

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-violet-100 text-violet-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default async function QuotePage({ params, searchParams }: PageProps<"/quotes/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const [found, role, templates] = await Promise.all([getQuote(id), getCurrentRole(), listTemplates(["quote", "general"])]);
  if (!found) notFound();

  const { quote, contact, opportunity, lines } = found;
  const writable = !!role && canWrite(role);
  const t = quoteTotals(lines, quote.tax_rate);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {opportunity ? (
            <Link href={`/opportunities/${opportunity.id}`} className="link text-sm">← {opportunity.title}</Link>
          ) : (
            <Link href="/opportunities" className="link text-sm">← Oportunidades</Link>
          )}
          <h1 className="page-title mt-1">{quote.number} · {quote.title}</h1>
          <p className="page-sub">
            {contact ? <Link href={`/contacts/${contact.id}`} className="link">{contact.name}</Link> : "—"} · emitido {fmtDate(`${quote.issue_date}T12:00:00Z`)}
            {quote.valid_until ? ` · válido hasta ${fmtDate(`${quote.valid_until}T12:00:00Z`)}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[quote.status]}`}>{QUOTE_STATUS_LABELS[quote.status]}</span>
      </div>

      {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}
      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}

      {writable && (
        <div className="flex flex-wrap items-center gap-2">
          {(["sent", "accepted", "rejected", "draft"] as QuoteStatus[])
            .filter((s) => s !== quote.status)
            .map((s) => (
              <form key={s} action={setQuoteStatus.bind(null, id)}>
                <input type="hidden" name="status" value={s} />
                <button type="submit" className="btn btn-secondary btn-sm">
                  {s === "sent" ? "Marcar como enviado" : s === "accepted" ? "Marcar como aceptado" : s === "rejected" ? "Marcar como rechazado" : "Volver a borrador"}
                </button>
              </form>
            ))}
          <form action={generateQuoteDocument.bind(null, id)} className="flex items-center gap-2">
            {templates.length > 1 && (
              <select name="template_id" aria-label="Plantilla" defaultValue={templates[0]?.id} className="input h-8 w-56 text-xs">
                {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}{t.is_default ? " (predeterminada)" : ""}</option>))}
              </select>
            )}
            {templates.length === 1 && <input type="hidden" name="template_id" value={templates[0].id} />}
            <button type="submit" className="btn btn-primary btn-sm">Generar PDF</button>
          </form>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Líneas</h2>
        <div className="table-card">
          <table>
            <thead><tr><th>Concepto</th><th className="w-24">Horas</th><th className="w-24">Cant.</th><th className="w-32">Precio (€)</th><th className="w-32 text-right">Importe</th><th className="w-40" /></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  {writable ? (
                    <>
                      <td colSpan={4} className="p-0">
                        <form id={`line-${l.id}`} action={updateQuoteLine.bind(null, id, l.id)} className="grid grid-cols-[1fr_6rem_6rem_8rem] items-center gap-2 px-4 py-2">
                          <input name="description" required defaultValue={l.description} aria-label="Concepto" className="input h-9" />
                          <input name="hours" defaultValue={l.hours ?? ""} inputMode="decimal" aria-label="Horas" className="input h-9" />
                          <input name="quantity" defaultValue={l.quantity} inputMode="decimal" aria-label="Cantidad" className="input h-9" />
                          <input name="unit_price" defaultValue={l.unit_price} inputMode="decimal" aria-label="Precio" className="input h-9" />
                        </form>
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(l.amount)}</td>
                      <td className="text-right">
                        <button type="submit" form={`line-${l.id}`} className="link mr-3 text-sm">Guardar</button>
                        <button type="submit" formAction={deleteQuoteLine.bind(null, id, l.id)} form={`line-${l.id}`} formNoValidate className="link-danger text-sm">Quitar</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{l.description}</td><td>{l.hours ?? "—"}</td><td>{l.quantity}</td><td className="tabular-nums">{formatMoney(l.unit_price)}</td>
                      <td className="text-right tabular-nums">{formatMoney(l.amount)}</td><td />
                    </>
                  )}
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted">Añade la primera línea del presupuesto.</td></tr>}
            </tbody>
          </table>
        </div>

        {writable && (
          <form action={addQuoteLine.bind(null, id)} className="card flex flex-wrap items-end gap-3 p-4">
            <label className="field min-w-64 flex-1">Concepto<input name="description" required className="input" placeholder="Ej.: Redacción del proyecto técnico" /></label>
            <label className="field w-24">Horas<input name="hours" inputMode="decimal" className="input" /></label>
            <label className="field w-24">Cant.<input name="quantity" inputMode="decimal" defaultValue="1" className="input" /></label>
            <label className="field w-32">Precio (€)<input name="unit_price" inputMode="decimal" className="input" /></label>
            <button type="submit" className="btn btn-secondary">Añadir línea</button>
          </form>
        )}

        <dl className="ml-auto w-full max-w-xs text-sm">
          <div className="flex justify-between py-1"><dt className="text-muted">Base imponible</dt><dd className="tabular-nums">{formatMoney(t.subtotal)}</dd></div>
          <div className="flex justify-between py-1"><dt className="text-muted">IVA ({quote.tax_rate}%)</dt><dd className="tabular-nums">{formatMoney(t.tax)}</dd></div>
          <div className="flex justify-between border-t border-slate-300 py-2 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(t.total)}</dd></div>
          <div className="flex justify-between py-1 text-xs"><dt className="text-muted">Horas presupuestadas</dt><dd>{t.hours} h</dd></div>
        </dl>
      </section>

      {writable && (
        <section className="card flex max-w-2xl flex-col gap-4 p-6">
          <h2 className="section-title">Datos del presupuesto</h2>
          <form action={updateQuote.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
            <label className="field sm:col-span-2">Título<input name="title" required defaultValue={quote.title} className="input" /></label>
            <label className="field">Válido hasta<input name="valid_until" type="date" defaultValue={quote.valid_until ?? ""} className="input" /></label>
            <label className="field">IVA (%)<input name="tax_rate" inputMode="decimal" defaultValue={quote.tax_rate} className="input" /></label>
            <label className="field sm:col-span-2">Condiciones y notas<textarea name="notes" rows={3} defaultValue={quote.notes ?? ""} className="input" /></label>
            <div><button type="submit" className="btn btn-primary">Guardar</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
