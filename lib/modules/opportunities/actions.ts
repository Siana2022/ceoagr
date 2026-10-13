"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { addDays, todayMadrid } from "@/lib/modules/format";
import { storeFile } from "@/lib/modules/documents/storage";
import { renderQuoteHtml } from "./quote-html";
import {
  lostSchema,
  opportunityFormToInput,
  opportunitySchema,
  quoteLineSchema,
  quoteMetaSchema,
} from "./schema";
import { getQuote } from "./queries";
import type { OppFormState } from "./types";

function values(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

const isUuid = (v: string) => z.uuid().safeParse(v).success;

function parseOpp(fd: FormData) {
  const parsed = opportunitySchema.safeParse(opportunityFormToInput(fd));
  if (parsed.success) return { ok: true, data: parsed.data } as const;
  const fieldErrors: Record<string, string> = {};
  for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return { ok: false, state: { error: "Revisa los campos marcados", fieldErrors, values: values(fd) } } as const;
}

export async function createOpportunity(_prev: OppFormState, fd: FormData): Promise<OppFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para crear oportunidades" };
  const r = parseOpp(fd);
  if (!r.ok) return r.state;

  const { owner_id, ...rest } = r.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .insert({ ...rest, ...(isStaffRole(role) && owner_id ? { owner_id } : {}) })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo crear la oportunidad", values: values(fd) };
  redirect(`/opportunities/${data.id}`);
}

export async function updateOpportunity(id: string, _prev: OppFormState, fd: FormData): Promise<OppFormState> {
  if (!isUuid(id)) return { error: "Oportunidad no válida" };
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso" };
  const r = parseOpp(fd);
  if (!r.ok) return r.state;

  const { owner_id, ...rest } = r.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .update({ ...rest, ...(isStaffRole(role) && owner_id ? { owner_id } : {}) })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "No se pudo guardar. Puede que no tengas permiso.", values: values(fd) };
  redirect(`/opportunities/${id}`);
}

export async function changeStage(id: string, fd: FormData) {
  const stage = z.enum(["lead", "study", "quote_sent", "negotiation", "won", "lost"]).safeParse(fd.get("stage"));
  const back = String(fd.get("back") ?? "") === "board" ? "/opportunities" : `/opportunities/${id}`;
  if (isUuid(id) && stage.success && stage.data !== "won" && stage.data !== "lost") {
    const supabase = await createClient();
    await supabase.from("opportunities").update({ stage: stage.data, lost_reason: null }).eq("id", id);
  }
  redirect(back);
}

export async function markLost(id: string, fd: FormData) {
  const parsed = lostSchema.safeParse({ lost_reason: fd.get("lost_reason") ?? "" });
  if (isUuid(id) && parsed.success) {
    const supabase = await createClient();
    await supabase.from("opportunities").update({ stage: "lost", lost_reason: parsed.data.lost_reason }).eq("id", id);
  }
  redirect(`/opportunities/${id}`);
}

export async function convertToProject(id: string, fd: FormData) {
  const typeId = String(fd.get("case_type_id") ?? "");
  if (!isUuid(id) || !isUuid(typeId)) redirect(`/opportunities/${id}?error=type`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_opportunity", { p_opportunity: id, p_case_type: typeId });
  if (error || !data) redirect(`/opportunities/${id}?error=convert`);
  redirect(`/cases/${data}`);
}

async function setOppArchived(id: string, archived: boolean) {
  if (isUuid(id)) {
    const supabase = await createClient();
    await supabase
      .from("opportunities")
      .update({ archived, archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id);
  }
  redirect(archived ? "/opportunities" : `/opportunities/${id}`);
}
export async function archiveOpportunity(id: string) {
  await setOppArchived(id, true);
}
export async function restoreOpportunity(id: string) {
  await setOppArchived(id, false);
}

// ----------------------------------------------------------------- quotes

export async function createQuote(opportunityId: string) {
  if (!isUuid(opportunityId)) redirect("/opportunities");
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect(`/opportunities/${opportunityId}`);

  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("opportunities")
    .select("contact_id, title, stage")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) redirect("/opportunities");

  const today = todayMadrid();
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      opportunity_id: opportunityId,
      contact_id: opp.contact_id,
      title: opp.title,
      issue_date: today,
      valid_until: addDays(today, 30),
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/opportunities/${opportunityId}?error=quote`);
  redirect(`/quotes/${data.id}`);
}

export async function updateQuote(id: string, fd: FormData) {
  if (!isUuid(id)) redirect("/opportunities");
  const parsed = quoteMetaSchema.safeParse({
    title: fd.get("title"),
    valid_until: fd.get("valid_until") ?? "",
    tax_rate: fd.get("tax_rate"),
    notes: fd.get("notes") ?? "",
  });
  if (!parsed.success) redirect(`/quotes/${id}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(parsed.data).eq("id", id);
  redirect(error ? `/quotes/${id}?error=No se pudo guardar` : `/quotes/${id}?saved=1`);
}

export async function setQuoteStatus(id: string, fd: FormData) {
  const status = z.enum(["draft", "sent", "accepted", "rejected", "expired"]).safeParse(fd.get("status"));
  if (isUuid(id) && status.success) {
    const supabase = await createClient();
    const { data: quote } = await supabase
      .from("quotes")
      .update({ status: status.data })
      .eq("id", id)
      .select("opportunity_id")
      .maybeSingle();

    // Sending a quote moves an early-stage opportunity to "Presupuesto enviado".
    if (status.data === "sent" && quote?.opportunity_id) {
      await supabase
        .from("opportunities")
        .update({ stage: "quote_sent" })
        .eq("id", quote.opportunity_id)
        .in("stage", ["lead", "study"]);
    }
  }
  redirect(`/quotes/${id}`);
}

export async function addQuoteLine(quoteId: string, fd: FormData) {
  if (!isUuid(quoteId)) redirect("/opportunities");
  const parsed = quoteLineSchema.safeParse({
    description: fd.get("description"),
    hours: fd.get("hours") ?? "",
    quantity: fd.get("quantity") ?? "",
    unit_price: fd.get("unit_price") ?? "",
  });
  if (!parsed.success) redirect(`/quotes/${quoteId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  const { count } = await supabase
    .from("quote_lines")
    .select("*", { count: "exact", head: true })
    .eq("quote_id", quoteId);
  const { error } = await supabase.from("quote_lines").insert({ ...parsed.data, quote_id: quoteId, position: count ?? 0 });
  redirect(error ? `/quotes/${quoteId}?error=No se pudo añadir la línea` : `/quotes/${quoteId}`);
}

export async function updateQuoteLine(quoteId: string, lineId: string, fd: FormData) {
  if (!isUuid(quoteId) || !isUuid(lineId)) redirect("/opportunities");
  const parsed = quoteLineSchema.safeParse({
    description: fd.get("description"),
    hours: fd.get("hours") ?? "",
    quantity: fd.get("quantity") ?? "",
    unit_price: fd.get("unit_price") ?? "",
  });
  if (!parsed.success) redirect(`/quotes/${quoteId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createClient();
  await supabase.from("quote_lines").update(parsed.data).eq("id", lineId);
  redirect(`/quotes/${quoteId}`);
}

export async function deleteQuoteLine(quoteId: string, lineId: string) {
  if (isUuid(lineId)) {
    const supabase = await createClient();
    await supabase.from("quote_lines").delete().eq("id", lineId);
  }
  redirect(`/quotes/${quoteId}`);
}

export async function generateQuoteDocument(id: string) {
  const role = await getCurrentRole();
  if (!isUuid(id) || !role || !canWrite(role)) redirect(`/quotes/${id}`);
  const found = await getQuote(id);
  if (!found || !found.contact) redirect("/opportunities");

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("name").maybeSingle();
  const a = found.contact.address ?? {};
  const html = renderQuoteHtml(found.quote, found.lines, {
    orgName: org?.name ?? "",
    client: {
      name: found.contact.name,
      tax_id: found.contact.tax_id,
      email: found.contact.email,
      address: [a.street, a.postal_code, a.city, a.province].filter(Boolean).join(", "),
    },
  });

  const name = `${found.quote.number} - ${found.quote.title}.html`;
  const r = await storeFile({
    file: new Blob([html], { type: "text/html" }),
    fileName: name,
    contentType: "text/html",
    target: { caseId: found.opportunity?.case_id ?? null, contactId: found.opportunity?.case_id ? null : found.contact.id },
    tags: ["presupuesto"],
  });
  redirect(r.id ? `/documents/${r.id}` : `/quotes/${id}?error=No se pudo generar el documento`);
}
