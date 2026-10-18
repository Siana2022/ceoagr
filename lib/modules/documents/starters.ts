import type { PageSettings } from "@/lib/modules/pdf/engine";
import { compileBlocks, newId, type Block } from "./blocks";
import type { TemplateContextKind } from "./variables";

export type StarterTemplate = {
  name: string;
  description: string;
  context: TemplateContextKind;
  is_default: boolean;
  page_settings: PageSettings;
  blocks: Block[];
};

const h = (level: 1 | 2 | 3, text: string): Block => ({ id: newId(), type: "heading", level, text, align: "left" });
const p = (text: string, opts: Partial<Omit<Extract<Block, { type: "text" }>, "id" | "type">> = {}): Block => ({
  id: newId(),
  type: "text",
  text,
  align: "left",
  bold: false,
  italic: false,
  ...opts,
});

export const STARTER_BLOCKS: Record<string, Block[]> = {
  "Presupuesto estándar": [
    h(1, "Presupuesto {{quote.number}}"),
    p("Fecha: {{quote.issue_date}} · Válido hasta: {{quote.valid_until}}", { bold: true }),
    h(3, "Cliente"),
    p("{{contact.name}}\nNIF/CIF: {{contact.tax_id}}\n{{contact.address}}"),
    h(2, "{{quote.title}}"),
    { id: newId(), type: "quote_lines" },
    { id: newId(), type: "quote_totals" },
    h(3, "Condiciones y notas"),
    p("{{quote.notes}}"),
    { id: newId(), type: "spacer", height: 24 },
    p("Atentamente,\n{{user.name}}\n{{org.name}}"),
  ],
  "Carta al cliente": [
    p("Valencia, {{today}}", { align: "right" }),
    p("{{contact.name}}\n{{contact.address}}"),
    { id: newId(), type: "spacer", height: 16 },
    p("Estimado/a cliente:"),
    p("Escribe aquí el contenido de la carta."),
    { id: newId(), type: "spacer", height: 16 },
    p("Un cordial saludo,"),
    p("{{user.name}}\n{{org.name}}"),
  ],
  "Informe de expediente": [
    h(1, "Informe del expediente {{case.code}}"),
    h(2, "{{case.title}}"),
    {
      id: newId(),
      type: "table",
      header: false,
      rows: [
        ["Cliente", "{{contact.name}}"],
        ["Estado", "{{case.status}}"],
        ["Apertura", "{{case.opened_at}}"],
        ["Fecha límite", "{{case.due_at}}"],
      ],
    },
    h(3, "Resumen"),
    p("Describe aquí el estado del trabajo."),
    { id: newId(), type: "spacer", height: 16 },
    p("{{user.name}} · {{org.name}} · {{today}}"),
  ],
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Presupuesto estándar",
    description: "Presupuesto con tabla de líneas, totales y condiciones.",
    context: "quote",
    is_default: true,
    page_settings: { header_logo: true, page_numbers: true },
    blocks: STARTER_BLOCKS["Presupuesto estándar"],
  },
  {
    name: "Carta al cliente",
    description: "Carta formal con fecha, destinatario y firma.",
    context: "contact",
    is_default: true,
    page_settings: { header_logo: true, page_numbers: false },
    blocks: STARTER_BLOCKS["Carta al cliente"],
  },
  {
    name: "Informe de expediente",
    description: "Resumen de datos de un expediente para el cliente.",
    context: "case",
    is_default: true,
    page_settings: { header_logo: true, page_numbers: true },
    blocks: STARTER_BLOCKS["Informe de expediente"],
  },
];

export function starterBody(t: StarterTemplate) {
  return compileBlocks(t.blocks);
}
