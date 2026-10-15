import { addDays } from "@/lib/modules/format";

export type GanttTaskInput = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  start: string | null; // yyyy-mm-dd
  due: string | null;
  assignee: string | null;
  priority: string;
};

export type GanttDependency = { task_id: string; depends_on_task_id: string };

export type GanttRow = {
  task: GanttTaskInput;
  startIdx: number;
  span: number; // days (>= 1)
  overdue: boolean;
  blocked: boolean; // waits for an unfinished task
  milestone: boolean; // only one date known
};

export type GanttArrow = { fromRow: number; toRow: number; fromEnd: number; toStart: number };

export type Gantt = {
  days: string[];
  rows: GanttRow[];
  undated: GanttTaskInput[];
  arrows: GanttArrow[];
  todayIdx: number | null;
};

const MAX_DAYS = 400;

export const dayDiff = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);

export function planTask(t: Pick<GanttTaskInput, "start" | "due">): { start: string; end: string; milestone: boolean } | null {
  if (!t.start && !t.due) return null;
  if (t.start && t.due) {
    return t.due >= t.start ? { start: t.start, end: t.due, milestone: false } : { start: t.due, end: t.start, milestone: false };
  }
  const d = (t.start ?? t.due)!;
  return { start: d, end: d, milestone: true };
}

// Lays tasks out on a day axis. Cancelled tasks are left out.
export function buildGantt(tasks: GanttTaskInput[], deps: GanttDependency[], today: string): Gantt {
  const active = tasks.filter((t) => t.status !== "cancelled");
  const planned = active
    .map((task) => ({ task, plan: planTask(task) }))
    .filter((x): x is { task: GanttTaskInput; plan: NonNullable<ReturnType<typeof planTask>> } => x.plan !== null);
  const undated = active.filter((t) => !planTask(t));

  if (planned.length === 0) return { days: [], rows: [], undated, arrows: [], todayIdx: null };

  const minStart = planned.reduce((m, x) => (x.plan.start < m ? x.plan.start : m), planned[0].plan.start);
  const maxEnd = planned.reduce((m, x) => (x.plan.end > m ? x.plan.end : m), planned[0].plan.end);
  const axisStart = addDays(minStart < today ? minStart : today, -2);
  const axisEnd = addDays(maxEnd > today ? maxEnd : today, 5);
  const total = Math.min(MAX_DAYS, dayDiff(axisStart, axisEnd) + 1);
  const days = Array.from({ length: total }, (_, i) => addDays(axisStart, i));

  const status = new Map(active.map((t) => [t.id, t.status]));
  const blockedBy = new Set(
    deps.filter((d) => status.has(d.task_id) && status.get(d.depends_on_task_id) !== undefined && status.get(d.depends_on_task_id) !== "done").map((d) => d.task_id),
  );

  const sorted = [...planned].sort((a, b) => a.plan.start.localeCompare(b.plan.start) || a.plan.end.localeCompare(b.plan.end) || a.task.title.localeCompare(b.task.title, "es"));
  const rowOf = new Map<string, number>();
  const rows: GanttRow[] = sorted.map(({ task, plan }, i) => {
    rowOf.set(task.id, i);
    const startIdx = Math.max(0, dayDiff(axisStart, plan.start));
    const endIdx = Math.min(total - 1, dayDiff(axisStart, plan.end));
    return {
      task,
      startIdx,
      span: Math.max(1, endIdx - startIdx + 1),
      overdue: plan.end < today && (task.status === "todo" || task.status === "in_progress"),
      blocked: blockedBy.has(task.id) && task.status !== "done",
      milestone: plan.milestone,
    };
  });

  const arrows: GanttArrow[] = [];
  for (const d of deps) {
    const from = rowOf.get(d.depends_on_task_id);
    const to = rowOf.get(d.task_id);
    if (from === undefined || to === undefined) continue;
    arrows.push({ fromRow: from, toRow: to, fromEnd: rows[from].startIdx + rows[from].span, toStart: rows[to].startIdx });
  }

  const ti = dayDiff(axisStart, today);
  return { days, rows, undated, arrows, todayIdx: ti >= 0 && ti < total ? ti : null };
}

// Month labels for the axis header: [{label, startIdx, span}].
export function monthSpans(days: string[]) {
  const out: { label: string; startIdx: number; span: number }[] = [];
  days.forEach((d, i) => {
    const key = d.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.label === key) last.span += 1;
    else out.push({ label: key, startIdx: i, span: 1 });
  });
  return out;
}
