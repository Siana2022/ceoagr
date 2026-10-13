import { describe, expect, it } from "vitest";
import { addDays, madridParts, madridToUtc, mondayOf } from "@/lib/modules/format";

describe("Madrid time helpers", () => {
  it("converts winter time (UTC+1) and summer time (UTC+2)", () => {
    expect(madridToUtc("2026-01-15", "10:00").toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(madridToUtc("2026-07-15", "10:00").toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("handles the day of the DST change", () => {
    // 2026-03-29: clocks go from 02:00 to 03:00 (UTC+1 -> UTC+2)
    expect(madridToUtc("2026-03-29", "01:30").toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(madridToUtc("2026-03-29", "04:00").toISOString()).toBe("2026-03-29T02:00:00.000Z");
  });

  it("round-trips through madridParts", () => {
    const p = madridParts(madridToUtc("2026-11-03", "17:45").toISOString());
    expect(p).toEqual({ date: "2026-11-03", time: "17:45", minutes: 17 * 60 + 45 });
  });

  it("computes weeks starting on Monday", () => {
    expect(mondayOf("2026-10-14")).toBe("2026-10-12"); // Wednesday
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});
