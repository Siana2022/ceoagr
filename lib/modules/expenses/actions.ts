"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { safeBack } from "@/lib/modules/redirect";
import { safeFileName } from "@/lib/modules/documents/storage";
import { priceExpense } from "./calc";
import { decisionSchema, expenseFormToInput, expenseSchema, ratesSchema } from "./schema";
import { getExpenseRates } from "./queries";
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES, type ExpenseFormState } from "./types";

function values(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function checkReceipt(file: FormDataEntryValue | null): { file?: File; error?: string } {
  if (!(file instanceof File) || file.size === 0) return {};
  if (file.size > MAX_RECEIPT_BYTES) return { error: "El ticket supera los 10 MB" };
  if (!RECEIPT_TYPES.includes(file.type)) return { error: "El ticket debe ser una imagen (JPG, PNG, WEBP, HEIC) o un PDF" };
  return { file };
}

async function uploadReceipt(expenseId: string, file: File): Promise<string | null> {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return null;
  const { base, ext } = safeFileName(file.name);
  const path = `org/${orgId}/expense/${expenseId}/${randomUUID()}-${base}${ext ? `.${ext}` : ""}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
  return error ? null : path;
}

function parse(fd: FormData) {
  const parsed = expenseSchema.safeParse(expenseFormToInput(fd));
  if (parsed.success) return { ok: true, data: parsed.data } as const;
  return { ok: false, error: parsed.error.issues[0].message } as const;
}

export async function createExpense(_prev: ExpenseFormState, fd: FormData): Promise<ExpenseFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para registrar gastos" };

  const p = parse(fd);
  if (!p.ok) return { error: p.error, values: values(fd) };
  const receipt = checkReceipt(fd.get("receipt"));
  if (receipt.error) return { error: receipt.error, values: values(fd) };

  const rates = await getExpenseRates();
  const priced = priceExpense(p.data, rates);
  if (!priced) return { error: "Revisa el importe, los kilómetros o los días", values: values(fd) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      kind: p.data.kind,
      expense_date: p.data.expense_date,
      case_id: p.data.case_id,
      description: p.data.description,
      billable: p.data.billable,
      ...priced,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: "No se pudo guardar. Comprueba que tienes acceso al expediente elegido.", values: values(fd) };
  }

  if (receipt.file) {
    const path = await uploadReceipt(data.id, receipt.file);
    if (!path) {
      await supabase.from("expenses").delete().eq("id", data.id);
      return { error: "No se pudo subir el ticket. Inténtalo de nuevo.", values: values(fd) };
    }
    await supabase.from("expenses").update({ receipt_path: path }).eq("id", data.id);
  }
  return { ok: true };
}

export async function deleteExpense(id: string, fd: FormData) {
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("expenses").delete().eq("id", id);
  }
  redirect(safeBack(fd, "/expenses"));
}

export async function resubmitExpense(id: string, fd: FormData) {
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("expenses").update({ status: "submitted" }).eq("id", id);
  }
  redirect(safeBack(fd, "/expenses"));
}

// Approve / reject / mark as reimbursed (permissions enforced in the database).
export async function decideExpense(id: string, fd: FormData) {
  const back = safeBack(fd, "/expenses/approvals");
  const role = await getCurrentRole();
  const parsed = decisionSchema.safeParse({ decision: fd.get("decision"), note: fd.get("note") ?? undefined });
  if (!role || !isStaffRole(role) || !z.uuid().safeParse(id).success || !parsed.success) redirect(back);

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_expense", {
    p_id: id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note ?? null,
  });
  const sep = back.includes("?") ? "&" : "?";
  redirect(error ? `${back}${sep}error=${encodeURIComponent(/reason/.test(error.message) ? "Indica el motivo del rechazo" : /own expense/.test(error.message) ? "No puedes decidir sobre tus propios gastos" : "No se pudo registrar la decisión")}` : back);
}

export async function saveExpenseRates(fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const parsed = ratesSchema.safeParse({
    km_rate: fd.get("km_rate"),
    dieta: fd.get("dieta"),
    dieta_overnight: fd.get("dieta_overnight"),
  });
  if (!parsed.success) redirect("/settings?error=1");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_expense_rates", {
    p_km: parsed.data.km_rate,
    p_dieta: parsed.data.dieta,
    p_dieta_overnight: parsed.data.dieta_overnight,
  });
  redirect(error ? "/settings?error=1" : "/settings?saved=1");
}
