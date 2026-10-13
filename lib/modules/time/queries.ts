import { createClient } from "@/lib/supabase/server";
import type { MemberRate, NotificationRow, TimeEntryListItem } from "./types";
import { normalizeRows, type ReportRow } from "./calc";

const SELECT = "*, cases(code, title), tasks(title)";

export async function getRunningEntry(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select(SELECT)
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  return (data as TimeEntryListItem | null) ?? null;
}

export async function listEntries(opts: { userId?: string; fromIso: string; toIso: string; caseId?: string; limit?: number }) {
  const supabase = await createClient();
  let q = supabase
    .from("time_entries")
    .select(SELECT)
    .not("ended_at", "is", null)
    .gte("started_at", opts.fromIso)
    .lt("started_at", opts.toIso)
    .order("started_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.caseId) q = q.eq("case_id", opts.caseId);
  const { data } = await q;
  return (data ?? []) as TimeEntryListItem[];
}

// Total logged minutes per case (visible to anyone who can see the case).
export async function getCaseMinutes(caseIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!caseIds.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.rpc("case_hours", { p_case_ids: caseIds });
  for (const r of (data ?? []) as { case_id: string; minutes: number | string }[]) {
    out.set(r.case_id, Number(r.minutes));
  }
  return out;
}

export async function getReportRows(from: string, to: string): Promise<{ rows: ReportRow[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("time_report_rows", { p_from: from, p_to: to });
  return { rows: normalizeRows((data ?? []) as Record<string, unknown>[]), error: !!error };
}

export async function getAlertThresholds(): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("settings").maybeSingle();
  const v = data?.settings?.time?.alert_thresholds;
  return Array.isArray(v) && v.length ? v.map(Number) : [80, 100];
}

export async function listRates(): Promise<MemberRate[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("member_rates").select("*").order("valid_from", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    cost_per_hour: Number(r.cost_per_hour),
    price_per_hour: Number(r.price_per_hour),
    valid_from: r.valid_from as string,
  }));
}

export async function listMyOpenTasks(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, case_id, cases(code)")
    .eq("assignee_id", userId)
    .in("status", ["todo", "in_progress"])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(100);
  return (data ?? []) as unknown as { id: string; title: string; case_id: string | null; cases: { code: string } | null }[];
}

export async function listNotifications(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}

export async function countUnreadNotifications() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  return error ? 0 : (count ?? 0);
}
