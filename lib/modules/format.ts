const TZ = "Europe/Madrid";

export function slugify(s: string, max = 40) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { timeZone: TZ });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// yyyy-mm-dd for <input type="date"> from a timestamptz.
export function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
}

// ------------------------------------------------------- timezone helpers

function tzOffsetMs(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - utcMs;
}

// Wall-clock date (yyyy-mm-dd) and time (HH:mm) in Madrid -> UTC instant.
export function madridToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffsetMs(guess, TZ);
  const second = guess - tzOffsetMs(utc, TZ);
  if (second !== utc) utc = second;
  return new Date(utc);
}

// UTC instant -> Madrid wall-clock parts.
export function madridParts(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { timeZone: TZ });
  const time = d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const [hh, mm] = time.split(":").map(Number);
  return { date, time, minutes: hh * 60 + mm };
}

// Calendar-date arithmetic on yyyy-mm-dd strings (no timezone involved).
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export function todayMadrid() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function isDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}
