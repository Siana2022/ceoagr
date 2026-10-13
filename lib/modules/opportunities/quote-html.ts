import { quoteTotals } from "./calc";
import type { Quote, QuoteLine } from "./types";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const dateEs = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC" }) : "—";

export type QuoteDocContext = {
  orgName: string;
  client: { name: string; tax_id?: string | null; address?: string | null; email?: string | null };
};

// Self-contained, print-ready HTML (open it and "Print > Save as PDF").
export function renderQuoteHtml(q: Quote, lines: QuoteLine[], ctx: QuoteDocContext) {
  const t = quoteTotals(lines, Number(q.tax_rate));
  const rows = lines
    .map(
      (l) => `<tr><td>${esc(l.description)}</td><td class="r">${l.hours ?? ""}</td><td class="r">${l.quantity}</td><td class="r">${eur(Number(l.unit_price))}</td><td class="r">${eur(Math.round(l.quantity * l.unit_price * 100) / 100)}</td></tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(q.number)} - ${esc(q.title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#222;max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.45}
h1{font-size:1.6rem;margin:0}.muted{color:#666;font-size:.9rem}
.head{display:flex;justify-content:space-between;border-bottom:3px solid #003366;padding-bottom:1rem;margin-bottom:1.5rem}
table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{padding:.5rem .6rem;border-bottom:1px solid #ddd;text-align:left;font-size:.92rem}
th{background:#f3f6fa}.r{text-align:right}.totals{margin-left:auto;width:280px}.totals td{border:0;padding:.25rem .6rem}
.grand td{font-weight:bold;font-size:1.05rem;border-top:2px solid #003366}
@media print{body{margin:0}}
</style></head><body>
<div class="head"><div><h1>${esc(ctx.orgName)}</h1><p class="muted">Presupuesto</p></div>
<div style="text-align:right"><strong>${esc(q.number)}</strong><br><span class="muted">Fecha: ${dateEs(q.issue_date)}<br>Válido hasta: ${dateEs(q.valid_until)}</span></div></div>
<p><strong>Cliente:</strong> ${esc(ctx.client.name)}${ctx.client.tax_id ? `<br>NIF/CIF: ${esc(ctx.client.tax_id)}` : ""}${ctx.client.address ? `<br>${esc(ctx.client.address)}` : ""}</p>
<h2 style="font-size:1.15rem">${esc(q.title)}</h2>
<table><thead><tr><th>Concepto</th><th class="r">Horas</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead><tbody>
${rows}
</tbody></table>
<table class="totals"><tr><td>Base imponible</td><td class="r">${eur(t.subtotal)}</td></tr>
<tr><td>IVA (${Number(q.tax_rate)}%)</td><td class="r">${eur(t.tax)}</td></tr>
<tr class="grand"><td>Total</td><td class="r">${eur(t.total)}</td></tr></table>
${q.notes ? `<h3 style="font-size:1rem">Condiciones y notas</h3><p style="white-space:pre-wrap">${esc(q.notes)}</p>` : ""}
</body></html>`;
}
