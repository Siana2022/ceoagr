import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { htmlToPdfContent } from "@/lib/modules/pdf/html";
import { buildDefinition, renderPdf } from "@/lib/modules/pdf/engine";

const flatten = (c: unknown): string => {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(flatten).join("");
  if (c && typeof c === "object") return Object.values(c as Record<string, unknown>).map(flatten).join("");
  return "";
};

describe("htmlToPdfContent", () => {
  it("maps headings, paragraphs, emphasis and alignment", () => {
    const c = htmlToPdfContent('<h1>Título</h1><p style="text-align: center">Hola <strong>mundo</strong> <em>cursiva</em></p>') as unknown as Record<string, unknown>[];
    expect(c[0]).toMatchObject({ bold: true, fontSize: 20 });
    expect(c[1]).toMatchObject({ alignment: "center" });
    const runs = c[1].text as { text: string; bold?: boolean; italics?: boolean }[];
    expect(runs.find((r) => r.text === "mundo")?.bold).toBe(true);
    expect(runs.find((r) => r.text === "cursiva")?.italics).toBe(true);
  });

  it("keeps empty paragraphs as blank lines and trims block edges", () => {
    const c = htmlToPdfContent("<p></p><p>  espacio  </p>") as unknown as Record<string, unknown>[];
    expect(c[0].text).toBe(" ");
    expect(flatten(c[1].text)).toBe("espacio");
  });

  it("builds lists, including list items wrapped in paragraphs", () => {
    const c = htmlToPdfContent("<ul><li><p>Uno</p></li><li><p>Dos</p></li></ul><ol><li>A</li></ol>") as unknown as Record<string, unknown>[];
    expect((c[0].ul as unknown[]).length).toBe(2);
    expect((c[1].ol as unknown[]).length).toBe(1);
  });

  it("builds tables with header cells, colspan padding and declared widths", () => {
    const c = htmlToPdfContent('<table data-widths="*,60"><thead><tr><th>Concepto</th><th style="text-align:right">Importe</th></tr></thead><tbody><tr><td colspan="2">Fila ancha</td></tr><tr><td>A</td></tr></tbody></table>') as { table: { body: unknown[][]; widths: unknown[]; headerRows: number } }[];
    const t = c[0].table;
    expect(t.widths).toEqual(["*", 60]);
    expect(t.headerRows).toBe(1);
    expect(t.body.every((r) => r.length === 2)).toBe(true);
    expect(t.body[0][1]).toMatchObject({ alignment: "right", bold: true });
  });

  it("only accepts embedded png/jpeg images", () => {
    const ok = htmlToPdfContent('<img src="data:image/png;base64,iVBORw0KGgo=" width="100">') as unknown as Record<string, unknown>[];
    expect(ok[0].image).toContain("data:image/png");
    expect(htmlToPdfContent('<img src="https://evil.example/x.png"><img src="data:image/svg+xml;base64,AAAA">')).toEqual([]);
  });

  it("only links http(s) and ignores scripts and styles", () => {
    const c = htmlToPdfContent('<p><a href="javascript:alert(1)">x</a> <a href="https://ejemplo.es">ok</a></p><script>alert(1)</script>');
    const runs = (c[0] as unknown as { text: { text: string; link?: string }[] }).text;
    expect(runs.find((r) => r.text === "x")?.link).toBeUndefined();
    expect(runs.find((r) => r.text === "ok")?.link).toBe("https://ejemplo.es");
    expect(flatten(c)).not.toContain("alert");
  });

  it("supports page breaks and rejects odd colors", () => {
    const c = htmlToPdfContent('<div data-page-break></div><p><span style="color: url(javascript:1)">a</span><span style="color:#ff0000">b</span></p>') as unknown as Record<string, unknown>[];
    expect(c[0]).toMatchObject({ pageBreak: "after" });
    const runs = c[1].text as { text: string; color?: string }[];
    expect(runs.find((r) => r.text === "a")?.color).toBeUndefined();
    expect(runs.find((r) => r.text === "b")?.color).toBe("#ff0000");
  });
});

describe("buildDefinition / renderPdf", () => {
  it("adds header and footer from branding and settings", () => {
    const def = buildDefinition("<p>x</p>", { page_numbers: true, footer_text: "AGR · B12345678" }, { name: "AGR", color: "#003366" }, "Doc");
    expect(def.header).toBeTypeOf("function");
    expect(def.footer).toBeTypeOf("function");
    expect(def.pageOrientation).toBe("portrait");
  });

  it("renders a real PDF with accents, euro sign and tables", async () => {
    const buf = await renderPdf(
      '<h1>Presupuesto ñandú</h1><p>Total: <strong>1.234,50 €</strong></p><table><thead><tr><th>Concepto</th><th>Importe</th></tr></thead><tbody><tr><td>Proyecto</td><td>1.000 €</td></tr></tbody></table><ul><li>Uno</li></ul>',
      {},
      { name: "AGR" },
      "Prueba",
    );
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(5000);
  });
});
