import { madridParts } from "@/lib/modules/format";

export type ClockKind = "in" | "out" | "pause_start" | "pause_end";

export const CLOCK_LABELS: Record<ClockKind, string> = {
  in: "Entrada",
  out: "Salida",
  pause_start: "Inicio de pausa",
  pause_end: "Fin de pausa",
};

export type ClockEvent = {
  id: string;
  user_id: string;
  kind: ClockKind;
  at: string;
  source: "web" | "mobile" | "manual";
  note: string | null;
};

export type Session = {
  day: string; // Madrid date of the clock-in
  start: string;
  end: string | null;
  workedMin: number;
  pauseMin: number;
  open: boolean;
};

export type DaySummary = {
  day: string;
  workedMin: number;
  pauseMin: number;
  first: string;
  last: string | null;
  open: boolean;
  manual: boolean;
};

const min = (ms: number) => Math.max(0, Math.round(ms / 60000));

// Replays one user's events in time order. Events that do not fit the current
// state (e.g. two "in" in a row) are skipped and counted as anomalies.
export function buildSessions(events: ClockEvent[], nowMs: number): { sessions: Session[]; anomalies: number } {
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const sessions: Session[] = [];
  let anomalies = 0;

  let state: "off" | "working" | "paused" = "off";
  let cur: { start: string; segStart: number; pauseStart: number; worked: number; pause: number } | null = null;

  const close = (endIso: string | null, endMs: number, open: boolean) => {
    if (!cur) return;
    sessions.push({
      day: madridParts(cur.start).date,
      start: cur.start,
      end: endIso,
      workedMin: min(cur.worked),
      pauseMin: min(cur.pause),
      open,
    });
    cur = null;
    void endMs;
  };

  for (const e of sorted) {
    const t = new Date(e.at).getTime();
    if (e.kind === "in" && state === "off") {
      cur = { start: e.at, segStart: t, pauseStart: 0, worked: 0, pause: 0 };
      state = "working";
    } else if (e.kind === "pause_start" && state === "working" && cur) {
      cur.worked += t - cur.segStart;
      cur.pauseStart = t;
      state = "paused";
    } else if (e.kind === "pause_end" && state === "paused" && cur) {
      cur.pause += t - cur.pauseStart;
      cur.segStart = t;
      state = "working";
    } else if (e.kind === "out" && state !== "off" && cur) {
      if (state === "working") cur.worked += t - cur.segStart;
      else cur.pause += t - cur.pauseStart;
      close(e.at, t, false);
      state = "off";
    } else {
      anomalies += 1;
    }
  }

  if (cur && state !== "off") {
    const c: NonNullable<typeof cur> = cur;
    if (state === "working") c.worked += nowMs - c.segStart;
    else c.pause += nowMs - c.pauseStart;
    close(null, nowMs, true);
  }
  return { sessions, anomalies };
}

export function currentState(events: Pick<ClockEvent, "kind" | "at">[]): "off" | "working" | "paused" {
  const last = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  if (!last || last.kind === "out") return "off";
  return last.kind === "pause_start" ? "paused" : "working";
}

export function summarizeDays(sessions: Session[], events: ClockEvent[]): Map<string, DaySummary> {
  const out = new Map<string, DaySummary>();
  const manualDays = new Set(events.filter((e) => e.source === "manual").map((e) => madridParts(e.at).date));

  for (const s of sessions) {
    const cur = out.get(s.day);
    out.set(s.day, {
      day: s.day,
      workedMin: (cur?.workedMin ?? 0) + s.workedMin,
      pauseMin: (cur?.pauseMin ?? 0) + s.pauseMin,
      first: cur && cur.first < s.start ? cur.first : s.start,
      last: s.end ?? cur?.last ?? null,
      open: (cur?.open ?? false) || s.open,
      manual: manualDays.has(s.day),
    });
  }
  return out;
}

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = next.slice(0, 7);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first, next, prev, nextMonth, daysInMonth };
}

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
