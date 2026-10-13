// Pure helpers behind the dashboards (unit-tested).

export type Period = { from: string; to: string; label: string };

export function periodFor(key: string, today: string): Period {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();

  switch (key) {
    case "last_month": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}`, label: "Mes anterior" };
    }
    case "quarter": {
      const qs = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${y}-${pad(qs)}-01`, to: `${y}-${pad(qs + 2)}-${pad(lastDay(y, qs + 2))}`, label: "Trimestre actual" };
    }
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: "Año actual" };
    default:
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}`, label: "Mes actual" };
  }
}

export const PERIOD_OPTIONS = [
  { key: "month", label: "Mes actual" },
  { key: "last_month", label: "Mes anterior" },
  { key: "quarter", label: "Trimestre actual" },
  { key: "year", label: "Año actual" },
] as const;

export type CountRow = { key: string; label: string; value: number; color?: string };

export function countBy<T>(items: T[], keyOf: (i: T) => string, labelOf: (k: string) => string, colorOf?: (k: string) => string | undefined): CountRow[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(keyOf(i), (m.get(keyOf(i)) ?? 0) + 1);
  return [...m.entries()].map(([key, value]) => ({ key, label: labelOf(key), value, color: colorOf?.(key) })).sort((a, b) => b.value - a.value);
}

export const maxOf = (rows: { value: number }[]) => rows.reduce((mx, r) => Math.max(mx, r.value), 0);

export function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// Overlap between [start, end) intervals and a window, in minutes.
export function overlapMinutes(startMs: number, endMs: number, winStartMs: number, winEndMs: number) {
  return Math.max(0, Math.round((Math.min(endMs, winEndMs) - Math.max(startMs, winStartMs)) / 60000));
}

// Working capacity of a window: Monday-Friday, 8 h per day.
export function workingMinutes(from: string, to: string, hoursPerDay = 8) {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n += 1;
  }
  return n * hoursPerDay * 60;
}
