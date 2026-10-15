// Human-readable summaries of audit_log rows (pure, unit-tested).

export const ENTITY_LABELS: Record<string, string> = {
  contacts: "Contacto",
  cases: "Expediente",
  tasks: "Tarea",
  opportunities: "Oportunidad",
  quotes: "Presupuesto",
  documents: "Documento",
  appointments: "Cita",
  time_entries: "Horas imputadas",
  expenses: "Gasto",
  clock_events: "Fichaje",
};

export const ACTION_LABELS: Record<string, string> = {
  insert: "Creación",
  update: "Modificación",
  delete: "Eliminación",
  merge: "Fusión",
};

const FIELD_LABELS: Record<string, string> = {
  name: "nombre", title: "título", status: "estado", stage: "fase", priority: "prioridad", email: "email",
  phone: "teléfono", mobile: "móvil", tax_id: "NIF/CIF", legal_name: "razón social", owner_id: "responsable",
  assignee_id: "asignada a", due_at: "vencimiento", start_at: "inicio", archived: "archivado", description: "descripción",
  amount: "importe", unit_amount: "importe unitario", quantity: "cantidad", kind: "tipo", billable: "facturable",
  expected_value: "valor estimado", budget_hours: "horas presupuestadas", fee_amount: "honorarios", notes: "notas",
  tags: "etiquetas", source: "origen", code: "código", number: "número", total: "total", minutes: "minutos",
};

const HIDDEN = new Set(["id", "org_id", "created_at", "updated_at", "created_by", "search", "custom_fields", "address"]);

const short = (v: unknown, max = 40) => {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

export function displayName(diff: Record<string, unknown>) {
  for (const k of ["name", "title", "code", "number", "description"]) {
    const v = diff[k];
    if (typeof v === "string" || typeof v === "number") return String(v);
  }
  // update diffs look like { field: { old, new } }
  for (const k of ["name", "title", "code", "number"]) {
    const v = diff[k] as { new?: unknown } | undefined;
    if (v && typeof v === "object" && v.new) return String(v.new);
  }
  return null;
}

export type AuditChange = { field: string; before: string; after: string };

export function changesOf(diff: Record<string, unknown>): AuditChange[] {
  const out: AuditChange[] = [];
  for (const [key, val] of Object.entries(diff)) {
    if (HIDDEN.has(key) || !val || typeof val !== "object" || !("new" in (val as object))) continue;
    const v = val as { old?: unknown; new?: unknown };
    out.push({ field: FIELD_LABELS[key] ?? key.replace(/_/g, " "), before: short(v.old), after: short(v.new) });
  }
  return out;
}

export function summarize(action: string, diff: Record<string, unknown>) {
  const name = displayName(diff);
  if (action === "update") {
    const ch = changesOf(diff);
    if (ch.length === 0) return { headline: "Sin cambios visibles", changes: [] as AuditChange[], more: 0 };
    return { headline: name ? String(name) : "", changes: ch.slice(0, 4), more: Math.max(0, ch.length - 4) };
  }
  if (action === "merge") {
    return { headline: `Se fusionó «${short(diff.merged_name, 60)}» en este contacto`, changes: [] as AuditChange[], more: 0 };
  }
  return { headline: name ? String(name) : "", changes: [] as AuditChange[], more: 0 };
}

export function entityHref(entity: string, id: string): string | null {
  switch (entity) {
    case "contacts": return `/contacts/${id}`;
    case "cases": return `/cases/${id}`;
    case "tasks": return `/tasks/${id}`;
    case "opportunities": return `/opportunities/${id}`;
    case "quotes": return `/quotes/${id}`;
    case "documents": return `/documents/${id}`;
    case "appointments": return `/calendar/${id}`;
    default: return null;
  }
}
