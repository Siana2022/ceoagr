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
