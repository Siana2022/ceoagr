// Pure helpers for time tracking and profitability (unit-tested).

export function formatMinutes(min: number | null | undefined) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatHours(min: number | null | undefined) {
  if (min == null) return "—";
  return (min / 60).toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

export function formatMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

// "1:30", "1,5", "1.5", "90m", "2h", "2h30" -> minutes (1..1440) or null.
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  let minutes: number | null = null;

  let m = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  if (m) minutes = Number(m[1]) * 60 + Number(m[2]);

  if (minutes === null && (m = /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*(?:m|min)?)?$/.exec(s))) {
    minutes = Math.round(Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
  }
  if (minutes === null && (m = /^(\d+)\s*(?:m|min)$/.exec(s))) minutes = Number(m[1]);
  if (minutes === null && (m = /^(\d+(?:\.\d+)?)$/.exec(s))) minutes = Math.round(Number(m[1]) * 60);

  if (minutes === null || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return null;
  return minutes;
}

export type BudgetLevel = "none" | "ok" | "warn" | "over";

export function budgetStatus(loggedMinutes: number, budgetHours: number | null | undefined, warnAt = 80) {
  if (!budgetHours || budgetHours <= 0) return { pct: null as number | null, level: "none" as BudgetLevel };
  const pct = (loggedMinutes / 60 / budgetHours) * 100;
  const level: BudgetLevel = pct >= 100 ? "over" : pct >= warnAt ? "warn" : "ok";
  return { pct, level };
}

export type ReportRow = {
  case_id: string | null;
  user_id: string;
  minutes: number;
  billable_minutes: number;
  cost: number | null;
  value: number | null;
};

export type Totals = { minutes: number; billable: number; cost: number | null; value: number | null };

const addNullable = (a: number | null, b: number | null) =>
  a === null && b === null ? null : (a ?? 0) + (b ?? 0);

export function groupReport<K>(rows: ReportRow[], keyOf: (r: ReportRow) => K): Map<K, Totals> {
  const out = new Map<K, Totals>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = out.get(k) ?? { minutes: 0, billable: 0, cost: null, value: null };
    out.set(k, {
      minutes: cur.minutes + r.minutes,
      billable: cur.billable + r.billable_minutes,
      cost: addNullable(cur.cost, r.cost),
      value: addNullable(cur.value, r.value),
    });
  }
  return out;
}

// Margin = fee - cost. Unknown when either side is unknown.
export function margin(fee: number | null | undefined, cost: number | null | undefined) {
  if (fee == null || cost == null) return null;
  return fee - cost;
}

// Normalizes rows coming from PostgREST (numerics arrive as strings).
export function normalizeRows(raw: Record<string, unknown>[]): ReportRow[] {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return raw.map((r) => ({
    case_id: (r.case_id as string | null) ?? null,
    user_id: r.user_id as string,
    minutes: Number(r.minutes ?? 0),
    billable_minutes: Number(r.billable_minutes ?? 0),
    cost: num(r.cost),
    value: num(r.value),
  }));
}

// Escapes a CSV cell (and neutralizes spreadsheet formula injection).
export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
