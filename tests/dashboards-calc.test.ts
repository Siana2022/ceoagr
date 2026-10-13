import { describe, expect, it } from "vitest";
import { countBy, maxOf, overlapMinutes, percent, periodFor, workingMinutes } from "@/lib/modules/dashboards/calc";

describe("periodFor", () => {
  it("builds month, previous month, quarter and year", () => {
    expect(periodFor("month", "2026-10-13")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodFor("last_month", "2026-10-13")).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodFor("last_month", "2026-01-05")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodFor("quarter", "2026-11-20")).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
    expect(periodFor("quarter", "2026-02-02")).toMatchObject({ from: "2026-01-01", to: "2026-03-31" });
    expect(periodFor("year", "2026-06-06")).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("handles leap February and unknown keys", () => {
    expect(periodFor("month", "2028-02-10").to).toBe("2028-02-29");
    expect(periodFor("???", "2026-10-13").label).toBe("Mes actual");
  });
});

describe("aggregations", () => {
  it("counts and sorts descending", () => {
    const rows = countBy([{ s: "a" }, { s: "b" }, { s: "a" }], (i) => i.s, (k) => k.toUpperCase());
    expect(rows).toEqual([{ key: "a", label: "A", value: 2, color: undefined }, { key: "b", label: "B", value: 1, color: undefined }]);
    expect(maxOf(rows)).toBe(2);
    expect(maxOf([])).toBe(0);
  });
  it("computes percentages safely", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });
});

describe("time windows", () => {
  it("clips overlaps to the window", () => {
    const h = 3600000;
    expect(overlapMinutes(0, 2 * h, 1 * h, 5 * h)).toBe(60);
    expect(overlapMinutes(0, h, 2 * h, 3 * h)).toBe(0);
  });
  it("counts weekdays only", () => {
    expect(workingMinutes("2026-10-12", "2026-10-18")).toBe(5 * 8 * 60); // Mon-Sun
    expect(workingMinutes("2026-10-17", "2026-10-18")).toBe(0); // weekend
  });
});
