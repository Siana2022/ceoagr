import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildContext, type OrgBranding } from "./context";
import { renderTemplate } from "./render";
import { storeFile } from "./storage";
import { renderPdf, type PageSettings, type PdfBranding } from "@/lib/modules/pdf/engine";
import { fmtDate } from "@/lib/modules/format";
import type { TemplateContextKind } from "./variables";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Ctx = Parameters<typeof buildContext>[0];

export type TemplateRow = {
  id: string;
  name: string;
  body: string;
  context: TemplateContextKind;
  page_settings: PageSettings;
};

export async function loadOrg(supabase: Supabase) {
  const { data } = await supabase.from("organizations").select("name, settings").maybeSingle();
  const branding = (data?.settings?.branding ?? {}) as OrgBranding;
  const pdf: PdfBranding = {
    name: data?.name ?? "",
    color: branding.color,
    logo_data: branding.logo_data ?? null,
    footer_text: branding.footer_text,
  };
  return { name: (data?.name ?? "") as string, branding, pdf };
}

export async function loadCurrentUser(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { name: "", email: "" };
  const { data } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
  return { name: data?.full_name ?? "", email: user.email ?? "" };
}

// Renders a stored template with the data of a contact, case or quote and returns the PDF bytes.
export async function renderTemplatePdf(
  supabase: Supabase,
  template: TemplateRow,
  ids: { caseId?: string | null; contactId?: string | null; quoteId?: string | null },
): Promise<{ pdf: Buffer; title: string; contactId: string | null; caseId: string | null; unknown: string[] }> {
  const [org, user] = await Promise.all([loadOrg(supabase), loadCurrentUser(supabase)]);

  let kase = null as Ctx["kase"];
  let contactId = ids.contactId ?? null;
  let caseId = ids.caseId ?? null;
  let quote = null as Ctx["quote"];

  if (ids.quoteId) {
    const { data: q } = await supabase.from("quotes").select("*, opportunities(case_id)").eq("id", ids.quoteId).maybeSingle();
    if (q) {
      const { data: lines } = await supabase.from("quote_lines").select("*").eq("quote_id", q.id).order("position").order("created_at");
      quote = {
        number: q.number, title: q.title, issue_date: q.issue_date, valid_until: q.valid_until, notes: q.notes,
        subtotal: Number(q.subtotal), tax_rate: Number(q.tax_rate), total: Number(q.total), total_hours: Number(q.total_hours),
        lines: (lines ?? []).map((l) => ({ description: l.description, hours: l.hours == null ? null : Number(l.hours), quantity: Number(l.quantity), unit_price: Number(l.unit_price), amount: Number(l.amount) })),
      };
      contactId = contactId ?? q.contact_id;
      caseId = caseId ?? (q.opportunities as { case_id: string | null } | null)?.case_id ?? null;
    }
  }

  if (caseId) {
    const { data } = await supabase
      .from("cases")
      .select("code, title, status, priority, opened_at, due_at, budget_hours, fee_amount, custom_fields, contact_id, case_types(pipeline)")
      .eq("id", caseId)
      .maybeSingle();
    if (data) {
      const pipeline = (data.case_types as unknown as { pipeline: { key: string; label: string }[] } | null)?.pipeline ?? [];
      kase = {
        code: data.code, title: data.title, status: data.status, priority: data.priority,
        statusLabel: pipeline.find((st) => st.key === data.status)?.label ?? data.status,
        opened_at: data.opened_at, due_at: data.due_at,
        budget_hours: data.budget_hours == null ? null : Number(data.budget_hours),
        fee_amount: data.fee_amount == null ? null : Number(data.fee_amount),
        custom_fields: data.custom_fields,
      };
      contactId = contactId ?? data.contact_id;
    }
  }

  let contact = null as Ctx["contact"];
  if (contactId) {
    const { data } = await supabase.from("contacts").select("name, legal_name, tax_id, email, phone, mobile, address").eq("id", contactId).maybeSingle();
    if (data) contact = data as Ctx["contact"];
  }

  const ctx = buildContext({ org: { name: org.name, branding: org.branding }, user, contact, kase, quote, today: fmtDate(new Date().toISOString()) });
  const { html, unknown } = renderTemplate(template.body, ctx);
  const title = [template.name, quote?.number ?? kase?.code ?? contact?.name].filter(Boolean).join(" - ");
  const pdf = await renderPdf(html, template.page_settings, org.pdf, title);
  return { pdf, title, contactId, caseId, unknown };
}

export async function generatePdfDocument(opts: {
  templateId: string;
  caseId?: string | null;
  contactId?: string | null;
  quoteId?: string | null;
}): Promise<{ documentId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("document_templates")
    .select("id, name, body, context, page_settings")
    .eq("id", opts.templateId)
    .maybeSingle();
  if (!template) return { error: "Plantilla no encontrada" };

  try {
    const r = await renderTemplatePdf(supabase, template as TemplateRow, opts);
    const stored = await storeFile({
      file: new Blob([new Uint8Array(r.pdf)], { type: "application/pdf" }),
      fileName: `${r.title}.pdf`,
      contentType: "application/pdf",
      target: { caseId: r.caseId, contactId: r.caseId ? null : r.contactId },
      tags: opts.quoteId ? ["presupuesto", "generado"] : ["generado"],
    });
    return stored.id ? { documentId: stored.id } : { error: stored.error };
  } catch {
    return { error: "No se pudo generar el PDF. Revisa la plantilla e inténtalo de nuevo." };
  }
}

