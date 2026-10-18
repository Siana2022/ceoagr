export type VarDef = { key: string; label: string; sample: string };
export type VarGroup = { id: "contact" | "case" | "quote" | "org" | "user" | "date"; label: string; vars: VarDef[] };
export type TemplateContextKind = "general" | "contact" | "case" | "quote";

export const CONTEXT_LABELS: Record<TemplateContextKind, string> = {
  general: "General (cualquier documento)",
  contact: "Para contactos",
  case: "Para expedientes",
  quote: "Para presupuestos",
};

export const VARIABLE_GROUPS: VarGroup[] = [
  {
    id: "contact",
    label: "Cliente / contacto",
    vars: [
      { key: "contact.name", label: "Nombre", sample: "Construcciones Levante S.L." },
      { key: "contact.legal_name", label: "Razón social", sample: "Construcciones Levante, S.L." },
      { key: "contact.tax_id", label: "NIF / CIF", sample: "B12345678" },
      { key: "contact.email", label: "Email", sample: "info@levante.example" },
      { key: "contact.phone", label: "Teléfono", sample: "961 11 22 33" },
      { key: "contact.mobile", label: "Móvil", sample: "600 11 22 33" },
      { key: "contact.address", label: "Dirección completa", sample: "Calle Mayor 1, 46001 Valencia" },
    ],
  },
  {
    id: "case",
    label: "Expediente",
    vars: [
      { key: "case.code", label: "Código", sample: "PRJ-2026-0007" },
      { key: "case.title", label: "Título", sample: "Instalación fotovoltaica nave 3" },
      { key: "case.status", label: "Estado", sample: "En curso" },
      { key: "case.priority", label: "Prioridad", sample: "Alta" },
      { key: "case.opened_at", label: "Fecha de apertura", sample: "05/10/2026" },
      { key: "case.due_at", label: "Fecha límite", sample: "30/11/2026" },
      { key: "case.budget_hours", label: "Horas presupuestadas", sample: "120" },
      { key: "case.fee_amount", label: "Honorarios", sample: "12.500,00 €" },
    ],
  },
  {
    id: "quote",
    label: "Presupuesto",
    vars: [
      { key: "quote.number", label: "Número", sample: "PRES-2026-0012" },
      { key: "quote.title", label: "Título", sample: "Proyecto de instalación eléctrica" },
      { key: "quote.issue_date", label: "Fecha de emisión", sample: "15/10/2026" },
      { key: "quote.valid_until", label: "Válido hasta", sample: "14/11/2026" },
      { key: "quote.subtotal", label: "Base imponible", sample: "3.500,00 €" },
      { key: "quote.tax_rate", label: "IVA (%)", sample: "21" },
      { key: "quote.tax", label: "Importe del IVA", sample: "735,00 €" },
      { key: "quote.total", label: "Total", sample: "4.235,00 €" },
      { key: "quote.total_hours", label: "Horas totales", sample: "80" },
      { key: "quote.notes", label: "Condiciones y notas", sample: "Pago 50% al aceptar y 50% a la entrega." },
      { key: "quote.lines_table", label: "Tabla de líneas", sample: "(tabla)" },
      { key: "quote.totals_table", label: "Tabla de totales", sample: "(tabla)" },
    ],
  },
  {
    id: "org",
    label: "Mi empresa",
    vars: [
      { key: "org.name", label: "Nombre", sample: "AGR Integral Engineering Solutions" },
      { key: "org.legal_name", label: "Razón social", sample: "AGR Ingeniería, S.L." },
      { key: "org.tax_id", label: "NIF / CIF", sample: "B98765432" },
      { key: "org.address", label: "Dirección", sample: "Av. del Puerto 10, 46023 Valencia" },
      { key: "org.phone", label: "Teléfono", sample: "960 090 483" },
      { key: "org.email", label: "Email", sample: "gerente@grupoagringenieria.com" },
      { key: "org.web", label: "Web", sample: "www.grupoagringenieria.com" },
      { key: "org.logo", label: "Logotipo (tamaño fijo)", sample: "(imagen)" },
      { key: "org.logo_data", label: "Logotipo (imagen, tamaño ajustable)", sample: "(imagen)" },
    ],
  },
  {
    id: "user",
    label: "Quien genera el documento",
    vars: [
      { key: "user.name", label: "Nombre", sample: "Laura Gómez" },
      { key: "user.email", label: "Email", sample: "laura@example.com" },
    ],
  },
  { id: "date", label: "Fecha", vars: [{ key: "today", label: "Fecha de hoy", sample: "15/10/2026" }] },
];

const GROUPS_BY_CONTEXT: Record<TemplateContextKind, VarGroup["id"][]> = {
  general: ["contact", "case", "quote", "org", "user", "date"],
  contact: ["contact", "org", "user", "date"],
  case: ["case", "contact", "org", "user", "date"],
  quote: ["quote", "contact", "org", "user", "date"],
};

export const groupsFor = (kind: TemplateContextKind) =>
  VARIABLE_GROUPS.filter((g) => GROUPS_BY_CONTEXT[kind].includes(g.id));

export function allVariableKeys() {
  return VARIABLE_GROUPS.flatMap((g) => g.vars.map((v) => v.key));
}
