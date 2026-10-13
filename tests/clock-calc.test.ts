import { describe, expect, it } from "vitest";
import { buildSessions, currentState, fmtHM, isMonth, monthRange, summarizeDays, type ClockEvent } from "@/lib/modules/clock/calc";

let n = 0;
const ev = (kind: ClockEvent["kind"], at: string, source: ClockEvent["source"] = "web"): ClockEvent => ({
  id: String(n++), user_id: "u", kind, at, source, note: source === "manual" ? "corrección" : null,
});
const NOW = new Date("2026-10-13T20:00:00Z").getTime();

describe("buildSessions", () => {
  it("computes worked and pause time", () => {
    const { sessions, anomalies } = buildSessions(
      [ev("in", "2026-10-13T07:00:00Z"), ev("pause_start", "2026-10-13T10:00:00Z"), ev("pause_end", "2026-10-13T10:30:00Z"), ev("out", "2026-10-13T15:00:00Z")],
      NOW,
    );
    expect(anomalies).toBe(0);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ workedMin: 3 * 60 + 4.5 * 60, pauseMin: 30, open: false, day: "2026-10-13" });
  });

  it("keeps an open session running until now", () => {
    const { sessions } = buildSessions([ev("in", "2026-10-13T18:00:00Z")], NOW);
    expect(sessions[0]).toMatchObject({ workedMin: 120, open: true, end: null });
  });

  it("counts a paused open session as pause time", () => {
    const { sessions } = buildSessions([ev("in", "2026-10-13T17:00:00Z"), ev("pause_start", "2026-10-13T18:00:00Z")], NOW);
    expect(sessions[0]).toMatchObject({ workedMin: 60, pauseMin: 120, open: true });
  });

  it("assigns an overnight shift to the day it started", () => {
    const { sessions } = buildSessions([ev("in", "2026-10-13T21:30:00Z"), ev("out", "2026-10-14T05:30:00Z")], NOW);
    expect(sessions[0].day).toBe("2026-10-13");
    expect(sessions[0].workedMin).toBe(480);
  });

  it("skips impossible transitions and reports them", () => {
    const { sessions, anomalies } = buildSessions(
      [ev("out", "2026-10-13T06:00:00Z"), ev("in", "2026-10-13T07:00:00Z"), ev("in", "2026-10-13T07:05:00Z"), ev("out", "2026-10-13T09:00:00Z")],
      NOW,
    );
    expect(anomalies).toBe(2);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].workedMin).toBe(120);
  });

  it("sorts unordered input", () => {
    const { sessions } = buildSessions([ev("out", "2026-10-13T09:00:00Z"), ev("in", "2026-10-13T07:00:00Z")], NOW);
    expect(sessions[0].workedMin).toBe(120);
  });
});

describe("summaries", () => {
  it("merges several sessions in one day and flags manual corrections", () => {
    const events = [
      ev("in", "2026-10-13T07:00:00Z"), ev("out", "2026-10-13T09:00:00Z"),
      ev("in", "2026-10-13T10:00:00Z", "manual"), ev("out", "2026-10-13T12:00:00Z", "manual"),
    ];
    const { sessions } = buildSessions(events, NOW);
    const day = summarizeDays(sessions, events).get("2026-10-13");
    expect(day).toMatchObject({ workedMin: 240, manual: true, open: false });
    expect(day?.first).toBe("2026-10-13T07:00:00Z");
  });

  it("derives the current state", () => {
    expect(currentState([])).toBe("off");
    expect(currentState([{ kind: "in", at: "2026-10-13T07:00:00Z" }])).toBe("working");
    expect(currentState([{ kind: "in", at: "2026-10-13T07:00:00Z" }, { kind: "pause_start", at: "2026-10-13T09:00:00Z" }])).toBe("paused");
    expect(currentState([{ kind: "in", at: "2026-10-13T07:00:00Z" }, { kind: "out", at: "2026-10-13T15:00:00Z" }])).toBe("off");
  });
});

describe("helpers", () => {
  it("formats h:mm and validates months", () => {
    expect(fmtHM(485)).toBe("8:05");
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
  });
  it("computes month ranges across year ends", () => {
    expect(monthRange("2026-12")).toMatchObject({ first: "2026-12-01", next: "2027-01-01", prev: "2026-11", nextMonth: "2027-01", daysInMonth: 31 });
    expect(monthRange("2026-02").daysInMonth).toBe(28);
  });
});
