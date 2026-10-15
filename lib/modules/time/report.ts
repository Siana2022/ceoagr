import { createClient } from "@/lib/supabase/server";
import { listMembers } from "@/lib/modules/members";
import { budgetStatus, groupReport, type BudgetLevel } from "./calc";
import { getExpenseReportRows } from "@/lib/modules/expenses/queries";
import { projectMargin } from "@/lib/modules/expenses/calc";
import { getAlertThresholds, getCaseMinutes, getReportRows } from "./queries";

export type CaseReportRow = {
  caseId: string | null;
  code: string;
  title: string;
  client: string;
  budgetHours: number | null;
  feeAmount: number | null;
  periodMinutes: number;
  billableMinutes: number;
  totalMinutes: number;
  pct: number | null;
  level: BudgetLevel;
  cost: number | null;
  value: number | null;
  expenses: number; // approved expenses in the period
  expensesBillable: number; // of those, re-billed to the client
  margin: number | null;
};

export type GroupReportRow = { key: string; name: string; minutes: number; billable: number; cost: number | null; value: number | null };

export type TimeReport = {
  error: boolean;
  byCase: CaseReportRow[];
  byClient: (GroupReportRow & { cases: number })[];
  byUser: GroupReportRow[];
  totals: { minutes: number; billable: number; cost: number | null; value: number | null; fee: number | null; expenses: number };
};

export async function buildTimeReport(from: string, to: string): Promise<TimeReport> {
  const supabase = await createClient();
  const [{ rows, error }, members, thresholds, expenseRows] = await Promise.all([
    getReportRows(from, to),
    listMembers(),
    getAlertThresholds(),
    getExpenseReportRows(from, to),
  ]);

  const expByCase = new Map<string, { approved: number; billable: number }>();
  for (const e of expenseRows) {
    if (!e.case_id) continue;
    const cur = expByCase.get(e.case_id) ?? { approved: 0, billable: 0 };
    expByCase.set(e.case_id, { approved: cur.approved + e.approved, billable: cur.billable + e.billable });
  }
  const caseIds = [...new Set([...rows.map((r) => r.case_id), ...expByCase.keys()].filter(Boolean))] as string[];
  const [{ data: cases }, totalMinutes] = await Promise.all([
    caseIds.length
      ? supabase
          .from("cases")
          .select("id, code, title, budget_hours, fee_amount, contact_id, contacts(name)")
          .in("id", caseIds)
      : Promise.resolve({ data: [] }),
    getCaseMinutes(caseIds),
  ]);
  const meta = new Map(
    ((cases ?? []) as unknown as {
      id: string; code: string; title: string; budget_hours: number | null; fee_amount: number | null;
      contact_id: string; contacts: { name: string } | null;
    }[]).map((c) => [c.id, c]),
  );

  const perCase = groupReport(rows, (r) => r.case_id);
  for (const id of expByCase.keys()) {
    if (!perCase.has(id)) perCase.set(id, { minutes: 0, billable: 0, cost: null, value: null });
  }
  const warnAt = thresholds[0] ?? 80;
  const byCase: CaseReportRow[] = [...perCase.entries()].map(([id, t]) => {
    const c = id ? meta.get(id) : undefined;
    const budget = c?.budget_hours != null ? Number(c.budget_hours) : null;
    const fee = c?.fee_amount != null ? Number(c.fee_amount) : null;
    const total = id ? (totalMinutes.get(id) ?? t.minutes) : t.minutes;
    const st = budgetStatus(total, budget, warnAt);
    const exp = id ? (expByCase.get(id) ?? { approved: 0, billable: 0 }) : { approved: 0, billable: 0 };
    return {
      caseId: id,
      code: c?.code ?? "—",
      title: c?.title ?? (id ? "Expediente no visible" : "Tiempo interno (sin expediente)"),
      client: c?.contacts?.name ?? "—",
      budgetHours: budget,
      feeAmount: fee,
      periodMinutes: t.minutes,
      billableMinutes: t.billable,
      totalMinutes: total,
      pct: st.pct,
      level: st.level,
      cost: t.cost,
      value: t.value,
      expenses: exp.approved,
      expensesBillable: exp.billable,
      margin: projectMargin(fee, t.cost, exp.approved - exp.billable),
    };
  }).sort((a, b) => b.periodMinutes - a.periodMinutes);

  const clientMap = new Map<string, GroupReportRow & { cases: number }>();
  for (const r of byCase) {
    const key = r.caseId ? (meta.get(r.caseId)?.contact_id ?? "unknown") : "internal";
    const name = r.caseId ? r.client : "Tiempo interno";
    const cur = clientMap.get(key) ?? { key, name, minutes: 0, billable: 0, cost: null, value: null, cases: 0 };
    clientMap.set(key, {
      ...cur,
      minutes: cur.minutes + r.periodMinutes,
      billable: cur.billable + r.billableMinutes,
      cost: r.cost === null && cur.cost === null ? null : (cur.cost ?? 0) + (r.cost ?? 0),
      value: r.value === null && cur.value === null ? null : (cur.value ?? 0) + (r.value ?? 0),
      cases: cur.cases + (r.caseId ? 1 : 0),
    });
  }

  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const byUser: GroupReportRow[] = [...groupReport(rows, (r) => r.user_id).entries()]
    .map(([id, t]) => ({ key: id, name: names.get(id) ?? "Usuario", minutes: t.minutes, billable: t.billable, cost: t.cost, value: t.value }))
    .sort((a, b) => b.minutes - a.minutes);

  const all = groupReport(rows, () => "all").get("all");
  const fees = byCase.map((c) => c.feeAmount).filter((v): v is number => v !== null);
  return {
    error,
    byCase,
    byClient: [...clientMap.values()].sort((a, b) => b.minutes - a.minutes),
    byUser,
    totals: {
      minutes: all?.minutes ?? 0,
      billable: all?.billable ?? 0,
      cost: all?.cost ?? null,
      value: all?.value ?? null,
      fee: fees.length ? fees.reduce((s, v) => s + v, 0) : null,
      expenses: byCase.reduce((sum, c) => sum + c.expenses, 0),
    },
  };
}

export function defaultPeriod(today: string) {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}
