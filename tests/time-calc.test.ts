import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  csvCell,
  formatMinutes,
  groupReport,
  margin,
  normalizeRows,
  parseDuration,
} from "@/lib/modules/time/calc";
import { manualEntrySchema, parseThresholds } from "@/lib/modules/time/schema";

describe("parseDuration", () => {
  it.each([
    ["1:30", 90],
    ["1,5", 90],
    ["1.5", 90],
    ["90m", 90],
    ["90 min", 90],
    ["2h", 120],
    ["2h30", 150],
    ["0:45", 45],
    ["8", 480],
  ])("%s -> %i", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
  it.each(["", "abc", "0", "25", "1:75", "-1", "1:5"])("rejects %j", (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats minutes", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(150)).toBe("2 h 30 min");
    expect(formatMinutes(null)).toBe("—");
  });
});

describe("budgetStatus", () => {
  it("classifies consumption", () => {
    expect(budgetStatus(60, null).level).toBe("none");
    expect(budgetStatus(60, 0).level).toBe("none");
    expect(budgetStatus(60, 10).level).toBe("ok"); // 10%
    expect(budgetStatus(8 * 60, 10).level).toBe("warn"); // 80%
    expect(budgetStatus(10 * 60, 10).level).toBe("over"); // 100%
    expect(budgetStatus(15 * 60, 10).pct).toBe(150);
  });
});

describe("report aggregation", () => {
  const rows = normalizeRows([
    { case_id: "c1", user_id: "u1", minutes: "120", billable_minutes: "120", cost: "80.5", value: "180" },
    { case_id: "c1", user_id: "u2", minutes: "60", billable_minutes: "0", cost: "30", value: "0" },
    { case_id: "c2", user_id: "u1", minutes: "30", billable_minutes: "30", cost: null, value: null },
  ]);
  it("sums by key and keeps unknown costs null", () => {
    const byCase = groupReport(rows, (r) => r.case_id);
    expect(byCase.get("c1")).toEqual({ minutes: 180, billable: 120, cost: 110.5, value: 180 });
    expect(byCase.get("c2")).toEqual({ minutes: 30, billable: 30, cost: null, value: null });
    expect(groupReport(rows, (r) => r.user_id).get("u1")?.minutes).toBe(150);
  });
  it("computes margin only when both sides are known", () => {
    expect(margin(1000, 110.5)).toBe(889.5);
    expect(margin(null, 10)).toBeNull();
    expect(margin(1000, null)).toBeNull();
  });
});

describe("csvCell", () => {
  it("quotes separators and neutralizes formulas", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});

describe("manual entry schema", () => {
  const base = { case_id: "", task_id: "", description: "", billable: true, date: "2026-10-13", start: "09:00", duration: "1:30" };
  it("builds a UTC start and minutes", () => {
    const r = manualEntrySchema.safeParse(base);
    expect(r.success && r.data.minutes).toBe(90);
    expect(r.success && r.data.started_at).toBe("2026-10-13T07:00:00.000Z");
  });
  it("rejects bad duration and bad date", () => {
    expect(manualEntrySchema.safeParse({ ...base, duration: "x" }).success).toBe(false);
    expect(manualEntrySchema.safeParse({ ...base, date: "2026-13-40" }).success).toBe(false);
  });
});

describe("thresholds", () => {
  it("parses, dedupes and sorts", () => {
    expect(parseThresholds("100, 80 80")).toEqual([80, 100]);
    expect(parseThresholds("")).toBeNull();
    expect(parseThresholds("0")).toBeNull();
    expect(parseThresholds("1,2,3,4,5,6,7")).toBeNull();
  });
});
