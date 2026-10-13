import { describe, expect, it } from "vitest";
import { assignLanes } from "@/lib/modules/agenda/layout";

describe("assignLanes", () => {
  it("keeps non-overlapping events in a single lane", () => {
    const r = assignLanes([
      { start: 0, end: 60 },
      { start: 60, end: 120 },
    ]);
    expect(r.map((x) => [x.lane, x.lanes])).toEqual([[0, 1], [0, 1]]);
  });

  it("splits overlapping events into lanes", () => {
    const r = assignLanes([
      { start: 0, end: 90 },
      { start: 30, end: 60 },
      { start: 100, end: 120 },
    ]);
    expect(r.map((x) => [x.lane, x.lanes])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });
});
