import { createClient } from "@/lib/supabase/server";
import { listMembers } from "@/lib/modules/members";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { listOpportunities } from "@/lib/modules/opportunities/queries";
import { pipelineStats } from "@/lib/modules/opportunities/calc";
import { listResources } from "@/lib/modules/agenda/queries";
import { buildTimeReport } from "@/lib/modules/time/report";
import { budgetStatus, groupReport, type BudgetLevel } from "@/lib/modules/time/calc";
import { getAlertThresholds, getCaseMinutes, getReportRows } from "@/lib/modules/time/queries";
import { listClockEvents } from "@/lib/modules/clock/queries";
import { buildSessions } from "@/lib/modules/clock/calc";
import { addDays, madridToUtc, nowMs, todayMadrid } from "@/lib/modules/format";
import { overlapMinutes, workingMinutes, type CountRow } from "./calc";

export type DashboardData = {
  statusRows: CountRow[];
  selectedTypeId: string | null;
  types: { id: string; name: string }[];
  workload: { userId: string; name: string; openTasks: number; overdue: number; minutes: number }[];
  budgetRisk: { id: string; code: string; title: string; pct: number; level: BudgetLevel; logged: number; budget: number }[];
  overdue: { total: number; items: { id: string; title: string; due: string; assignee: string; code: string | null }[] };
  funnel: ReturnType<typeof pipelineStats> | null;
  occupancy: { name: string; color: string; booked: number; capacity: number }[];
  profitability: Awaited<ReturnType<typeof buildTimeReport>> | null;
  utilization: { name: string; clocked: number; logged: number }[] | null;
};

export async function loadDashboard(opts: { from: string; to: string; typeId?: string; isAdmin: boolean }): Promise<DashboardData> {
  const supabase = await createClient();
  const today = todayMadrid();
  const fromIso = madridToUtc(opts.from, "00:00").toISOString();
  const toIso = madridToUtc(addDays(opts.to, 1), "00:00").toISOString();

  const [types, members, thresholds, casesRes, tasksRes, apptsRes, resources, opps, reportRows] = await Promise.all([
    listCaseTypes(true),
    listMembers(),
    getAlertThresholds(),
    supabase
      .from("cases")
      .select("id, code, title, status, case_type_id, budget_hours, closed_at")
      .eq("archived", false)
      .limit(3000),
    supabase
      .from("tasks")
      .select("id, title, status, assignee_id, due_at, case_id, cases(code)")
      .in("status", ["todo", "in_progress"])
      .limit(5000),
    supabase
      .from("appointments")
      .select("resource_id, starts_at, ends_at, status")
      .neq("status", "cancelled")
      .gte("ends_at", fromIso)
      .lt("starts_at", toIso)
      .limit(5000),
    listResources(),
    listOpportunities({ limit: 2000 }),
    getReportRows(opts.from, opts.to),
  ]);

  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const cases = (casesRes.data ?? []) as { id: string; code: string; title: string; status: string; case_type_id: string; budget_hours: number | null; closed_at: string | null }[];
  const tasks = (tasksRes.data ?? []) as unknown as { id: string; title: string; status: string; assignee_id: string | null; due_at: string | null; case_id: string | null; cases: { code: string } | null }[];

  // 1. Cases by status, for one case type.
  const typeIds = new Set(cases.map((c) => c.case_type_id));
  const selectedType = types.find((t) => t.id === opts.typeId && typeIds.has(t.id)) ?? types.find((t) => typeIds.has(t.id)) ?? null;
  const statusRows = selectedType
    ? selectedType.pipeline.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        value: cases.filter((c) => c.case_type_id === selectedType.id && c.status === s.key).length,
      }))
    : [];

  // 2. Workload per person: open tasks, overdue and hours in the period.
  const todayStr = today;
  const isOverdue = (t: { due_at: string | null }) => !!t.due_at && t.due_at.slice(0, 10) < todayStr;
  const minutesByUser = groupReport(reportRows.rows, (r) => r.user_id);
  const workloadIds = new Set<string>([...tasks.map((t) => t.assignee_id).filter(Boolean) as string[], ...minutesByUser.keys()]);
  const workload = [...workloadIds]
    .map((userId) => {
      const mine = tasks.filter((t) => t.assignee_id === userId);
      return {
        userId,
        name: names.get(userId) ?? "Usuario",
        openTasks: mine.length,
        overdue: mine.filter(isOverdue).length,
        minutes: minutesByUser.get(userId)?.minutes ?? 0,
      };
    })
    .sort((a, b) => b.openTasks - a.openTasks);

  // 3. Open projects closest to (or over) their hour budget.
  const budgeted = cases.filter((c) => !c.closed_at && c.budget_hours && Number(c.budget_hours) > 0);
  const minutes = await getCaseMinutes(budgeted.map((c) => c.id));
  const budgetRisk = budgeted
    .map((c) => {
      const logged = minutes.get(c.id) ?? 0;
      const st = budgetStatus(logged, Number(c.budget_hours), thresholds[0] ?? 80);
      return { id: c.id, code: c.code, title: c.title, pct: st.pct ?? 0, level: st.level, logged, budget: Number(c.budget_hours) };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  // 4. Overdue tasks.
  const late = tasks.filter(isOverdue).sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const overdue = {
    total: late.length,
    items: late.slice(0, 8).map((t) => ({
      id: t.id,
      title: t.title,
      due: (t.due_at ?? "").slice(0, 10),
      assignee: (t.assignee_id && names.get(t.assignee_id)) || "Sin asignar",
      code: t.cases?.code ?? null,
    })),
  };

  // 5. Sales funnel.
  const funnel = pipelineStats(opps.rows);

  // 6. Agenda occupancy per resource in the period.
  const appts = (apptsRes.data ?? []) as { resource_id: string; starts_at: string; ends_at: string }[];
  const winStart = new Date(fromIso).getTime();
  const winEnd = new Date(toIso).getTime();
  const capacity = workingMinutes(opts.from, opts.to);
  const occupancy = resources.map((r) => ({
    name: r.name,
    color: r.color,
    capacity,
    booked: appts
      .filter((a) => a.resource_id === r.id)
      .reduce((s, a) => s + overlapMinutes(new Date(a.starts_at).getTime(), new Date(a.ends_at).getTime(), winStart, winEnd), 0),
  }));

  // 7 + 8. Money and clocked-vs-logged hours (admins).
  let profitability: DashboardData["profitability"] = null;
  let utilization: DashboardData["utilization"] = null;
  if (opts.isAdmin) {
    profitability = await buildTimeReport(opts.from, opts.to);
    const events = await listClockEvents({
      fromIso: madridToUtc(addDays(opts.from, -2), "00:00").toISOString(),
      toIso,
    });
    const byUser = new Map<string, typeof events>();
    for (const e of events) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
    utilization = [...byUser.entries()]
      .map(([userId, evs]) => {
        const { sessions } = buildSessions(evs, nowMs());
        const clocked = sessions
          .filter((s) => s.day >= opts.from && s.day <= opts.to)
          .reduce((sum, s) => sum + s.workedMin, 0);
        return { name: names.get(userId) ?? "Usuario", clocked, logged: minutesByUser.get(userId)?.minutes ?? 0 };
      })
      .sort((a, b) => b.clocked - a.clocked);
  }

  return {
    statusRows,
    selectedTypeId: selectedType?.id ?? null,
    types: types.filter((t) => typeIds.has(t.id)).map((t) => ({ id: t.id, name: t.name })),
    workload,
    budgetRisk,
    overdue,
    funnel,
    occupancy,
    profitability,
    utilization,
  };
}
