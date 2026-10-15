import { createClient } from "@/lib/supabase/server";
import { DEFAULT_RATES, type Expense, type ExpenseListItem, type ExpenseRates, type ExpenseStatus } from "./types";

const num = (v: unknown) => Number(v ?? 0);

function normalize(r: Record<string, unknown>): ExpenseListItem {
  return { ...r, quantity: num(r.quantity), unit_amount: num(r.unit_amount), amount: num(r.amount) } as unknown as ExpenseListItem;
}

export async function getExpenseRates(): Promise<ExpenseRates> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("settings").maybeSingle();
  const s = data?.settings?.expenses;
  return {
    km_rate: Number(s?.km_rate ?? DEFAULT_RATES.km_rate),
    dieta: Number(s?.dieta ?? DEFAULT_RATES.dieta),
    dieta_overnight: Number(s?.dieta_overnight ?? DEFAULT_RATES.dieta_overnight),
  };
}

export async function listExpenses(opts: {
  userId?: string;
  status?: ExpenseStatus;
  fromDate?: string;
  toDate?: string;
  caseId?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("expenses")
    .select("*, cases(code)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 300);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.fromDate) q = q.gte("expense_date", opts.fromDate);
  if (opts.toDate) q = q.lte("expense_date", opts.toDate);
  if (opts.caseId) q = q.eq("case_id", opts.caseId);
  const { data, error } = await q;
  const rows = ((data ?? []) as Record<string, unknown>[]).map(normalize);

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
    for (const p of profiles ?? []) names.set(p.user_id, p.full_name);
  }
  return { rows, names, error: error?.message ?? null };
}

export async function countPendingApprovals() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("status", "submitted");
  return error ? 0 : (count ?? 0);
}

export type ExpenseReportRow = { case_id: string | null; user_id: string; approved: number; billable: number; pending: number };

export async function getExpenseReportRows(from: string, to: string): Promise<ExpenseReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("expense_report_rows", { p_from: from, p_to: to });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    case_id: (r.case_id as string | null) ?? null,
    user_id: r.user_id as string,
    approved: num(r.approved_total),
    billable: num(r.billable_total),
    pending: num(r.pending_total),
  }));
}

export type { Expense };
