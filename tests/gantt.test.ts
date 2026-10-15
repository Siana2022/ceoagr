import { describe, expect, it } from "vitest";
import { buildGantt, dayDiff, monthSpans, planTask, type GanttTaskInput } from "@/lib/modules/tasks/gantt";

const task = (id: string, o: Partial<GanttTaskInput> = {}): GanttTaskInput => ({
  id, title: id, status: "todo", start: null, due: null, assignee: null, priority: "normal", ...o,
});
const TODAY = "2026-10-15";

describe("planTask", () => {
  it("handles both dates, one date, none and swapped dates", () => {
    expect(planTask({ start: "2026-10-01", due: "2026-10-05" })).toEqual({ start: "2026-10-01", end: "2026-10-05", milestone: false });
    expect(planTask({ start: null, due: "2026-10-05" })).toEqual({ start: "2026-10-05", end: "2026-10-05", milestone: true });
    expect(planTask({ start: "2026-10-05", due: null })).toEqual({ start: "2026-10-05", end: "2026-10-05", milestone: true });
    expect(planTask({ start: null, due: null })).toBeNull();
    expect(planTask({ start: "2026-10-09", due: "2026-10-02" })).toEqual({ start: "2026-10-02", end: "2026-10-09", milestone: false });
  });
});

describe("buildGantt", () => {
  it("positions bars on a day axis and marks today", () => {
    const g = buildGantt([task("a", { start: "2026-10-10", due: "2026-10-14" }), task("b", { start: "2026-10-16", due: "2026-10-20" })], [], TODAY);
    expect(g.rows.map((r) => r.task.id)).toEqual(["a", "b"]);
    expect(g.days[0]).toBe("2026-10-08"); // earliest date minus 2 days
    expect(g.rows[0]).toMatchObject({ startIdx: 2, span: 5 });
    expect(g.rows[1]).toMatchObject({ startIdx: 8, span: 5 });
    expect(g.days[g.todayIdx!]).toBe(TODAY);
  });

  it("separates undated tasks and ignores cancelled ones", () => {
    const g = buildGantt([task("a", { due: "2026-10-20" }), task("b"), task("c", { status: "cancelled", due: "2026-10-20" })], [], TODAY);
    expect(g.rows.map((r) => r.task.id)).toEqual(["a"]);
    expect(g.undated.map((t) => t.id)).toEqual(["b"]);
    expect(g.rows[0].milestone).toBe(true);
  });

  it("flags overdue (open, past end) but not done tasks", () => {
    const g = buildGantt([
      task("late", { start: "2026-10-01", due: "2026-10-05" }),
      task("done", { start: "2026-10-01", due: "2026-10-05", status: "done" }),
      task("future", { start: "2026-10-20", due: "2026-10-25" }),
    ], [], TODAY);
    const by = Object.fromEntries(g.rows.map((r) => [r.task.id, r]));
    expect(by.late.overdue).toBe(true);
    expect(by.done.overdue).toBe(false);
    expect(by.future.overdue).toBe(false);
  });

  it("marks blocked tasks and builds finish-to-start arrows", () => {
    const g = buildGantt(
      [task("a", { start: "2026-10-10", due: "2026-10-12" }), task("b", { start: "2026-10-13", due: "2026-10-15" }), task("c", { start: "2026-10-16", due: "2026-10-18", status: "in_progress" })],
      [{ task_id: "b", depends_on_task_id: "a" }, { task_id: "c", depends_on_task_id: "b" }],
      TODAY,
    );
    const by = Object.fromEntries(g.rows.map((r) => [r.task.id, r]));
    expect(by.b.blocked).toBe(true);
    expect(by.c.blocked).toBe(true);
    expect(by.a.blocked).toBe(false);
    expect(g.arrows).toHaveLength(2);
    expect(g.arrows[0]).toMatchObject({ fromRow: 0, toRow: 1, fromEnd: by.a.startIdx + by.a.span, toStart: by.b.startIdx });
  });

  it("does not block when the prerequisite is done", () => {
    const g = buildGantt(
      [task("a", { start: "2026-10-10", due: "2026-10-12", status: "done" }), task("b", { start: "2026-10-13", due: "2026-10-15" })],
      [{ task_id: "b", depends_on_task_id: "a" }],
      TODAY,
    );
    expect(g.rows.find((r) => r.task.id === "b")?.blocked).toBe(false);
  });

  it("returns an empty chart when nothing has dates", () => {
    const g = buildGantt([task("a")], [], TODAY);
    expect(g.rows).toEqual([]);
    expect(g.undated).toHaveLength(1);
  });

  it("caps very long ranges", () => {
    const g = buildGantt([task("a", { start: "2020-01-01", due: "2026-12-31" })], [], TODAY);
    expect(g.days.length).toBeLessThanOrEqual(400);
  });
});

describe("axis helpers", () => {
  it("diffs days and groups months", () => {
    expect(dayDiff("2026-10-01", "2026-10-15")).toBe(14);
    expect(monthSpans(["2026-10-30", "2026-10-31", "2026-11-01"])).toEqual([
      { label: "2026-10", startIdx: 0, span: 2 },
      { label: "2026-11", startIdx: 2, span: 1 },
    ]);
  });
});
