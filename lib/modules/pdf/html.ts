// Converts the restricted HTML produced by the template editor (and by our own
// generators) into pdfmake content. Only a whitelisted subset is understood;
// anything else is reduced to its text. Nothing is ever executed.
import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";
import type { Content, ContentText } from "pdfmake/interfaces";

export type PdfTheme = { brand: string; brandSoft: string };
export const DEFAULT_THEME: PdfTheme = { brand: "#003366", brandSoft: "#e6eef7" };

type Run = ContentText;
const isTag = (n: ChildNode): n is Element => n.type === "tag";
const isText = (n: ChildNode): n is ChildNode & { data: string } => n.type === "text";

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "hr", "blockquote", "div", "pre", "section"]);
const HEADING_SIZE: Record<string, number> = { h1: 20, h2: 16, h3: 13.5, h4: 12, h5: 11, h6: 10.5 };

function styleOf(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (el.attribs.style ?? "").split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

const safeColor = (v?: string) => (v && /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i.test(v) ? v : undefined);

function alignOf(el: Element): "left" | "center" | "right" | "justify" | undefined {
  const a = (styleOf(el)["text-align"] ?? el.attribs.align ?? "").toLowerCase();
  return a === "center" || a === "right" || a === "justify" ? a : undefined;
}

// ---------------------------------------------------------------- inlines

function inlineRuns(nodes: ChildNode[], inherited: Partial<Run> = {}): Run[] {
  const runs: Run[] = [];
  for (const n of nodes) {
    if (isText(n)) {
      const text = n.data.replace(/\s+/g, " ");
      if (text) runs.push({ ...inherited, text });
    } else if (isTag(n)) {
      const tag = n.name.toLowerCase();
      if (tag === "br") {
        runs.push({ ...inherited, text: "\n" });
        continue;
      }
      const next: Partial<Run> = { ...inherited };
      if (tag === "strong" || tag === "b") next.bold = true;
      if (tag === "em" || tag === "i") next.italics = true;
      if (tag === "u") next.decoration = [...new Set([...(next.decoration as string[] | undefined ?? []), "underline"])] as Run["decoration"];
      if (tag === "s" || tag === "del" || tag === "strike") next.decoration = [...new Set([...(next.decoration as string[] | undefined ?? []), "lineThrough"])] as Run["decoration"];
      if (tag === "code") next.background = "#f1f5f9";
      if (tag === "a" && /^https?:\/\//i.test(n.attribs.href ?? "")) {
        next.link = n.attribs.href;
        next.color = "#0b5cad";
        next.decoration = [...new Set([...(next.decoration as string[] | undefined ?? []), "underline"])] as Run["decoration"];
      }
      const color = safeColor(styleOf(n).color);
      if (color) next.color = color;
      if (BLOCK_TAGS.has(tag)) {
        // block inside inline context: flatten with line breaks
        runs.push(...inlineRuns(n.children as ChildNode[], next), { ...next, text: "\n" });
      } else {
        runs.push(...inlineRuns(n.children as ChildNode[], next));
      }
    }
  }
  return runs;
}

function trimRuns(runs: Run[]): Run[] {
  const out = runs.map((r) => ({ ...r }));
  while (out.length && typeof out[0].text === "string" && out[0].text.trim() === "" && out[0].text !== "\n") out.shift();
  if (out.length && typeof out[0].text === "string") out[0].text = out[0].text.replace(/^\s+/, "");
  while (out.length && typeof out[out.length - 1].text === "string" && (out[out.length - 1].text as string).trim() === "") out.pop();
  const last = out[out.length - 1];
  if (last && typeof last.text === "string") last.text = last.text.replace(/\s+$/, "");
  return out;
}

// ----------------------------------------------------------------- blocks

const hasBlockChild = (el: Element) => (el.children as ChildNode[]).some((c) => isTag(c) && BLOCK_TAGS.has(c.name.toLowerCase()));

function imageNode(el: Element): Content | null {
  const src = el.attribs.src ?? "";
  if (!/^data:image\/(png|jpe?g);base64,[a-z0-9+/=]+$/i.test(src)) return null;
  const w = Number.parseFloat(el.attribs.width ?? styleOf(el).width ?? "");
  const width = Number.isFinite(w) && w > 0 ? Math.min(w * 0.75, 480) : undefined;
  return { image: src, ...(width ? { width } : { fit: [320, 160] as [number, number] }), margin: [0, 0, 0, 6] };
}

function cellContent(el: Element, theme: PdfTheme, header: boolean): Content {
  const blocks = toBlocks(el.children as ChildNode[], theme);
  const align = alignOf(el);
  const content: Content =
    blocks.length === 0
      ? { text: " " }
      : blocks.length === 1 && typeof blocks[0] === "object" && blocks[0] !== null && "text" in blocks[0]
        ? { ...(blocks[0] as ContentText), margin: [0, 0, 0, 0] }
        : { stack: blocks };
  const obj = content as unknown as Record<string, unknown>;
  if (align) obj.alignment = align;
  if (header) {
    obj.bold = true;
    obj.fillColor = theme.brandSoft;
  }
  const colspan = Number.parseInt(el.attribs.colspan ?? "1", 10);
  if (colspan > 1) obj.colSpan = Math.min(colspan, 12);
  return content;
}

function tableNode(el: Element, theme: PdfTheme): Content | null {
  const rows: Element[] = [];
  const collect = (nodes: ChildNode[]) => {
    for (const n of nodes) {
      if (!isTag(n)) continue;
      const tag = n.name.toLowerCase();
      if (tag === "tr") rows.push(n);
      else if (tag === "thead" || tag === "tbody" || tag === "tfoot") collect(n.children as ChildNode[]);
    }
  };
  collect(el.children as ChildNode[]);
  if (rows.length === 0) return null;

  const body: Content[][] = rows.map((tr) => {
    const cells: Content[] = [];
    for (const c of tr.children as ChildNode[]) {
      if (!isTag(c)) continue;
      const tag = c.name.toLowerCase();
      if (tag !== "td" && tag !== "th") continue;
      const content = cellContent(c, theme, tag === "th");
      cells.push(content);
      const span = (content as { colSpan?: number }).colSpan ?? 1;
      for (let i = 1; i < span; i++) cells.push({ text: "" });
    }
    return cells;
  });
  const cols = Math.max(...body.map((r) => r.length), 1);
  for (const r of body) while (r.length < cols) r.push({ text: "" });

  const declared = (el.attribs["data-widths"] ?? "").split(",").map((w) => w.trim());
  const widths = declared.length === cols
    ? declared.map((w) => (w === "*" || w === "auto" ? w : Number.isFinite(Number(w)) ? Number(w) : "*"))
    : Array.from({ length: cols }, () => "*" as const);
  const headerRows = rows.filter((tr) => (tr.children as ChildNode[]).some((c) => isTag(c) && c.name.toLowerCase() === "th")).length;

  return {
    table: { headerRows: Math.min(headerRows, 1), widths, body },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 2, 0, 10],
  } as Content;
}

function listNode(el: Element, theme: PdfTheme): Content | null {
  const items: Content[] = [];
  for (const li of el.children as ChildNode[]) {
    if (!isTag(li) || li.name.toLowerCase() !== "li") continue;
    const blocks = toBlocks(li.children as ChildNode[], theme).map((b) =>
      typeof b === "object" && b !== null && "text" in b ? ({ ...b, margin: [0, 0, 0, 2] } as Content) : b,
    );
    items.push(blocks.length === 1 ? blocks[0] : { stack: blocks });
  }
  if (items.length === 0) return null;
  const tag = el.name.toLowerCase();
  return (tag === "ol" ? { ol: items, margin: [0, 0, 0, 8] } : { ul: items, margin: [0, 0, 0, 8] }) as Content;
}

export function toBlocks(nodes: ChildNode[], theme: PdfTheme = DEFAULT_THEME): Content[] {
  const out: Content[] = [];
  let pending: ChildNode[] = []; // loose inline nodes between blocks

  const flush = () => {
    if (pending.length === 0) return;
    const runs = trimRuns(inlineRuns(pending));
    if (runs.length) out.push({ text: runs, margin: [0, 0, 0, 6] } as Content);
    pending = [];
  };

  for (const n of nodes) {
    if (isText(n) || (isTag(n) && !BLOCK_TAGS.has(n.name.toLowerCase()) && n.name.toLowerCase() !== "img")) {
      pending.push(n);
      continue;
    }
    if (!isTag(n)) continue;
    const tag = n.name.toLowerCase();

    if (tag === "img") {
      flush();
      const img = imageNode(n);
      if (img) out.push(img);
    } else if (tag === "p") {
      flush();
      const hasImg = (n.children as ChildNode[]).some((c) => isTag(c) && c.name.toLowerCase() === "img");
      if (hasImg) {
        for (const c of n.children as ChildNode[]) {
          if (isTag(c) && c.name.toLowerCase() === "img") {
            const img = imageNode(c);
            if (img) out.push(img);
          } else if (isText(c) || isTag(c)) {
            const runs = trimRuns(inlineRuns([c]));
            if (runs.length) out.push({ text: runs, margin: [0, 0, 0, 6] } as Content);
          }
        }
      } else {
        const runs = trimRuns(inlineRuns(n.children as ChildNode[]));
        const align = alignOf(n);
        out.push({ text: runs.length ? runs : " ", margin: [0, 0, 0, 6], ...(align ? { alignment: align } : {}) } as Content);
      }
    } else if (tag in HEADING_SIZE) {
      flush();
      const runs = trimRuns(inlineRuns(n.children as ChildNode[]));
      const align = alignOf(n);
      out.push({
        text: runs.length ? runs : " ",
        fontSize: HEADING_SIZE[tag],
        bold: true,
        color: tag === "h1" || tag === "h2" ? theme.brand : "#0f172a",
        margin: [0, tag === "h1" ? 4 : 8, 0, 6],
        ...(align ? { alignment: align } : {}),
      } as Content);
    } else if (tag === "ul" || tag === "ol") {
      flush();
      const l = listNode(n, theme);
      if (l) out.push(l);
    } else if (tag === "table") {
      flush();
      const t = tableNode(n, theme);
      if (t) out.push(t);
    } else if (tag === "hr") {
      flush();
      out.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.7, lineColor: "#cbd5e1" }], margin: [0, 6, 0, 8] } as Content);
    } else if (tag === "blockquote") {
      flush();
      out.push({ stack: toBlocks(n.children as ChildNode[], theme), margin: [14, 2, 0, 8], italics: true, color: "#475569" } as Content);
    } else if (tag === "div" || tag === "section" || tag === "pre") {
      flush();
      if (n.attribs["data-page-break"] !== undefined) {
        out.push({ text: "", pageBreak: "after" } as Content);
      } else if (hasBlockChild(n)) {
        out.push(...toBlocks(n.children as ChildNode[], theme));
      } else {
        const runs = trimRuns(inlineRuns(n.children as ChildNode[]));
        if (runs.length) out.push({ text: runs, margin: [0, 0, 0, 6] } as Content);
      }
    }
  }
  flush();
  return out;
}

export function htmlToPdfContent(html: string, theme: PdfTheme = DEFAULT_THEME): Content[] {
  const doc = parseDocument(html);
  return toBlocks(doc.children as ChildNode[], theme);
}
