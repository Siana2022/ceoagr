import { fmtDate } from "@/lib/modules/format";
import { PRIORITY_LABELS, type Priority } from "@/lib/modules/cases/types";
import { Raw, escapeHtml, type TemplateContext } from "./render";
import { VARIABLE_GROUPS } from "./variables";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" } as Intl.NumberFormatOptions);
const dateEs = (iso: string | null | undefined) => (iso ? fmtDate(iso.length === 10 ? `${iso}T12:00:00Z` : iso) : "");
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export type OrgBranding = {
  legal_name?: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  web?: string;
  color?: string;
  footer_text?: string;
  logo_data?: string | null;
};

export function addressLine(a: Record<string, string | undefined> | null | undefined) {
  if (!a) return "";
  return [a.street, [a.postal_code, a.city].filter(Boolean).join(" "), a.province, a.country].filter(Boolean).join(", ");
}

export function quoteLinesHtml(lines: { description: string; hours: number | null; quantity: number; unit_price: number; amount: number }[]) {
  const rows = lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.description)}</td><td style="text-align:right">${l.hours ?? ""}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">${escapeHtml(eur(Number(l.unit_price)))}</td><td style="text-align:right">${escapeHtml(eur(Number(l.amount)))}</td></tr>`,
    )
    .join("");
  return `<table data-widths="*,42,42,70,72"><thead><tr><th>Concepto</th><th style="text-align:right">Horas</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Importe</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin líneas</td><td></td><td></td><td></td><td></td></tr>'}</tbody></table>`;
}

export function quoteTotalsHtml(t: { subtotal: number; taxRate: number; tax: number; total: number }) {
  return `<table data-widths="*,100" data-width="270" data-borders="totals"><tbody><tr><td style="text-align:right">Base imponible</td><td style="text-align:right">${escapeHtml(eur(t.subtotal))}</td></tr><tr><td style="text-align:right">IVA (${t.taxRate}%)</td><td style="text-align:right">${escapeHtml(eur(t.tax))}</td></tr><tr><td style="text-align:right"><strong>Total</strong></td><td style="text-align:right"><strong>${escapeHtml(eur(t.total))}</strong></td></tr></tbody></table>`;
}

type ContactRow = { name: string; legal_name?: string | null; tax_id?: string | null; email?: string | null; phone?: string | null; mobile?: string | null; address?: Record<string, string> | null };
type CaseRow = { code: string; title: string; status: string; statusLabel?: string; priority: string; opened_at?: string | null; due_at?: string | null; budget_hours?: number | null; fee_amount?: number | null; custom_fields?: Record<string, unknown> | null };
type QuoteRow = { number: string; title: string; issue_date: string; valid_until: string | null; subtotal: number; tax_rate: number; total: number; total_hours: number; notes: string | null };
type LineRow = { description: string; hours: number | null; quantity: number; unit_price: number; amount: number };

export function buildContext(input: {
  org: { name: string; branding?: OrgBranding };
  user?: { name?: string; email?: string };
  contact?: ContactRow | null;
  kase?: CaseRow | null;
  quote?: (QuoteRow & { lines: LineRow[] }) | null;
  today: string;
}): TemplateContext {
  const b = input.org.branding ?? {};
  const ctx: TemplateContext = {
    today: input.today,
    org: {
      name: input.org.name,
      legal_name: b.legal_name ?? "",
      tax_id: b.tax_id ?? "",
      address: b.address ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      web: b.web ?? "",
      logo: new Raw(b.logo_data ? `<img src="${b.logo_data}" width="140">` : ""),
      logo_data: b.logo_data ?? "",
    },
    user: { name: input.user?.name ?? "", email: input.user?.email ?? "" },
    contact: {},
    case: {},
    quote: {},
  };

  if (input.contact) {
    const c = input.contact;
    ctx.contact = { name: c.name, legal_name: str(c.legal_name), tax_id: str(c.tax_id), email: str(c.email), phone: str(c.phone), mobile: str(c.mobile), address: addressLine(c.address) };
  }
  if (input.kase) {
    const k = input.kase;
    ctx.case = {
      code: k.code,
      title: k.title,
      status: k.statusLabel ?? k.status,
      priority: PRIORITY_LABELS[k.priority as Priority] ?? k.priority,
      opened_at: dateEs(k.opened_at),
      due_at: dateEs(k.due_at),
      budget_hours: k.budget_hours == null ? "" : String(k.budget_hours),
      fee_amount: k.fee_amount == null ? "" : eur(Number(k.fee_amount)),
      custom: Object.fromEntries(Object.entries(k.custom_fields ?? {}).map(([key, v]) => [key, typeof v === "boolean" ? (v ? "Sí" : "No") : str(v)])),
    };
  }
  if (input.quote) {
    const q = input.quote;
    const tax = Math.round(q.subtotal * q.tax_rate) / 100;
    ctx.quote = {
      number: q.number,
      title: q.title,
      issue_date: dateEs(q.issue_date),
      valid_until: dateEs(q.valid_until),
      subtotal: eur(q.subtotal),
      tax_rate: String(q.tax_rate),
      tax: eur(tax),
      total: eur(q.total),
      total_hours: String(q.total_hours),
      notes: q.notes ?? "",
      lines_table: new Raw(quoteLinesHtml(q.lines)),
      totals_table: new Raw(quoteTotalsHtml({ subtotal: q.subtotal, taxRate: q.tax_rate, tax, total: q.total })),
    };
  }
  return ctx;
}

// Realistic fake data so a template can be previewed without picking a record.
export function sampleContext(org: { name: string; branding?: OrgBranding }, today: string): TemplateContext {
  const sample = (key: string) => VARIABLE_GROUPS.flatMap((g) => g.vars).find((v) => v.key === key)?.sample ?? "";
  const lines = [
    { description: "Estudio previo y toma de datos", hours: 20, quantity: 1, unit_price: 1500, amount: 1500 },
    { description: "Redacción del proyecto técnico", hours: 60, quantity: 2, unit_price: 1000, amount: 2000 },
  ];
  return buildContext({
    org,
    user: { name: sample("user.name"), email: sample("user.email") },
    contact: { name: sample("contact.name"), legal_name: sample("contact.legal_name"), tax_id: sample("contact.tax_id"), email: sample("contact.email"), phone: sample("contact.phone"), mobile: sample("contact.mobile"), address: { street: "Calle Mayor 1", postal_code: "46001", city: "Valencia" } },
    kase: { code: sample("case.code"), title: sample("case.title"), status: "en_curso", statusLabel: sample("case.status"), priority: "high", opened_at: "2026-10-05T10:00:00Z", due_at: "2026-11-30T10:00:00Z", budget_hours: 120, fee_amount: 12500 },
    quote: { number: sample("quote.number"), title: sample("quote.title"), issue_date: "2026-10-15", valid_until: "2026-11-14", subtotal: 3500, tax_rate: 21, total: 4235, total_hours: 80, notes: sample("quote.notes"), lines },
    today,
  });
}
