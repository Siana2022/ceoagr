// Block model for the drag-and-drop template builder (pure, unit-tested).
// Blocks compile to the same restricted HTML subset the PDF engine already
// understands (see lib/modules/pdf/html.ts), so the render pipeline never changes.
import { escapeHtml } from "./render";

export type Align = "left" | "center" | "right";

export type HeadingBlock = { id: string; type: "heading"; level: 1 | 2 | 3; text: string; align: Align };
export type TextBlock = { id: string; type: "text"; text: string; align: Align; bold: boolean; italic: boolean };
export type ImageBlock = { id: string; type: "image"; source: "logo" | "custom"; data: string; width: number; align: Align };
export type DividerBlock = { id: string; type: "divider" };
export type SpacerBlock = { id: string; type: "spacer"; height: number };
export type QuoteLinesBlock = { id: string; type: "quote_lines" };
export type QuoteTotalsBlock = { id: string; type: "quote_totals" };
export type TableBlock = { id: string; type: "table"; header: boolean; rows: string[][] };
export type HtmlBlock = { id: string; type: "html"; html: string };

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | QuoteLinesBlock
  | QuoteTotalsBlock
  | TableBlock
  | HtmlBlock;

export const BLOCK_LABELS: Record<Block["type"], string> = {
  heading: "Título",
  text: "Texto",
  image: "Imagen / logotipo",
  divider: "Línea separadora",
  spacer: "Espacio",
  quote_lines: "Tabla de líneas del presupuesto",
  quote_totals: "Totales del presupuesto",
  table: "Tabla",
  html: "HTML (avanzado)",
};

let seq = 0;
export function newId() {
  seq += 1;
  return `b${Date.now().toString(36)}${seq}`;
}

export function defaultBlock(type: Block["type"]): Block {
  switch (type) {
    case "heading":
      return { id: newId(), type: "heading", level: 1, text: "Título", align: "left" };
    case "text":
      return { id: newId(), type: "text", text: "Escribe aquí el texto. Usa “Insertar dato” para añadir {{contact.name}} y otros campos.", align: "left", bold: false, italic: false };
    case "image":
      return { id: newId(), type: "image", source: "logo", data: "", width: 140, align: "left" };
    case "divider":
      return { id: newId(), type: "divider" };
    case "spacer":
      return { id: newId(), type: "spacer", height: 16 };
    case "quote_lines":
      return { id: newId(), type: "quote_lines" };
    case "quote_totals":
      return { id: newId(), type: "quote_totals" };
    case "table": {
      return { id: newId(), type: "table", header: true, rows: [["Columna 1", "Columna 2"], ["", ""]] };
    }
    case "html":
      return { id: newId(), type: "html", html: "<p></p>" };
  }
}

// Which block types make sense for a given template use. Quote-only blocks are
// hidden outside the "quote" context so nobody builds a presupuesto table into a letter.
export function availableBlockTypes(context: string): Block["type"][] {
  const base: Block["type"][] = ["heading", "text", "image", "table", "divider", "spacer"];
  return context === "quote" ? [...base.slice(0, 3), "quote_lines", "quote_totals", ...base.slice(3)] : base;
}

const alignStyle = (a: Align) => (a === "left" ? "" : ` style="text-align: ${a}"`);

function textWithTokens(text: string): string {
  // Escaping is safe here: {{ }} and the variable-key characters are never
  // touched by escapeHtml, so {{contact.name}} survives intact for the render step.
  return escapeHtml(text).replace(/\n/g, "<br>");
}

export function compileBlock(block: Block): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}${alignStyle(block.align)}>${textWithTokens(block.text) || "&nbsp;"}</h${block.level}>`;
    case "text": {
      let inner = textWithTokens(block.text) || "&nbsp;";
      if (block.bold) inner = `<strong>${inner}</strong>`;
      if (block.italic) inner = `<em>${inner}</em>`;
      return `<p${alignStyle(block.align)}>${inner}</p>`;
    }
    case "image": {
      const src = block.source === "logo" ? "{{org.logo_data}}" : block.data;
      if (!src) return "";
      const w = Math.min(Math.max(block.width, 20), 500);
      return `<p${alignStyle(block.align)}><img src="${src}" width="${w}"></p>`;
    }
    case "divider":
      return "<hr>";
    case "spacer":
      return `<div style="height:${Math.min(Math.max(block.height, 0), 120)}px"></div>`;
    case "quote_lines":
      return "<p>{{quote.lines_table}}</p>";
    case "quote_totals":
      return "<p>{{quote.totals_table}}</p>";
    case "table": {
      const widths = (block.rows[0] ?? []).map(() => "*").join(",");
      const row = (cells: string[], tag: "th" | "td") =>
        `<tr>${cells.map((c) => `<${tag}>${textWithTokens(c)}</${tag}>`).join("")}</tr>`;
      const [first, ...rest] = block.rows;
      const head = block.header && first ? `<thead>${row(first, "th")}</thead>` : "";
      const bodyRows = block.header ? rest : block.rows;
      const body = bodyRows.map((r) => row(r, "td")).join("");
      return `<table data-widths="${widths}">${head}<tbody>${body}</tbody></table>`;
    }
    case "html":
      return block.html;
  }
}

export function compileBlocks(blocks: Block[]): string {
  return blocks.map(compileBlock).join("\n");
}

// Best-effort wrapper so templates saved before the block builder existed still
// open in it: their HTML becomes a single editable "advanced HTML" block.
export function blocksFromLegacyHtml(html: string): Block[] {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>") return [];
  return [{ id: newId(), type: "html", html }];
}

export function normalizeTableRows(rows: string[][]): string[][] {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
}
