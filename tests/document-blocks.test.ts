import { describe, expect, it } from "vitest";
import {
  availableBlockTypes,
  blocksFromLegacyHtml,
  compileBlock,
  compileBlocks,
  defaultBlock,
  insertBlockAt,
  moveBlockTo,
  normalizeTableRows,
  type Block,
} from "@/lib/modules/documents/blocks";
import { renderTemplate } from "@/lib/modules/documents/render";
import { htmlToPdfContent } from "@/lib/modules/pdf/html";

describe("compileBlock", () => {
  it("compiles headings with alignment and keeps variable tokens intact", () => {
    const html = compileBlock({ id: "1", type: "heading", level: 2, text: "Hola {{contact.name}}", align: "center" });
    expect(html).toBe('<h2 style="text-align: center">Hola {{contact.name}}</h2>');
  });

  it("escapes HTML in user text but never touches {{tokens}}", () => {
    const html = compileBlock({ id: "1", type: "text", text: "<script>x</script> {{contact.name}} & cía", align: "left", bold: false, italic: false });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("{{contact.name}}");
    expect(html).not.toContain("<script>");
  });

  it("wraps bold/italic text and keeps line breaks", () => {
    const html = compileBlock({ id: "1", type: "text", text: "uno\ndos", align: "left", bold: true, italic: true });
    expect(html).toBe('<p><em><strong>uno<br>dos</strong></em></p>');
  });

  it("uses a safe placeholder for empty headings/text so pdfmake never sees an empty run", () => {
    expect(compileBlock({ id: "1", type: "heading", level: 1, text: "", align: "left" })).toContain("&nbsp;");
    expect(compileBlock({ id: "1", type: "text", text: "", align: "left", bold: false, italic: false })).toContain("&nbsp;");
  });

  it("compiles the logo image via the org.logo_data variable, sized and aligned", () => {
    const html = compileBlock({ id: "1", type: "image", source: "logo", data: "", width: 90, align: "center" });
    expect(html).toBe('<p style="text-align: center"><img src="{{org.logo_data}}" width="90"></p>');
  });

  it("compiles a custom uploaded image with its own data and clamps absurd widths", () => {
    const html = compileBlock({ id: "1", type: "image", source: "custom", data: "data:image/png;base64,AAAA", width: 9999, align: "left" });
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('width="500"');
  });

  it("omits the image entirely when there is nothing to show", () => {
    expect(compileBlock({ id: "1", type: "image", source: "custom", data: "", width: 100, align: "left" })).toBe("");
  });

  it("compiles quote placeholders, divider and spacer", () => {
    expect(compileBlock({ id: "1", type: "quote_lines" })).toBe("<p>{{quote.lines_table}}</p>");
    expect(compileBlock({ id: "1", type: "quote_totals" })).toBe("<p>{{quote.totals_table}}</p>");
    expect(compileBlock({ id: "1", type: "divider" })).toBe("<hr>");
    expect(compileBlock({ id: "1", type: "spacer", height: 999 })).toContain("height:120px");
  });

  it("compiles a table with a header row and escapes cell content", () => {
    const html = compileBlock({ id: "1", type: "table", header: true, rows: [["Concepto", "{{case.code}}"], ["Fila & 1", "x"]] });
    expect(html).toContain("<thead><tr><th>Concepto</th><th>{{case.code}}</th></tr></thead>");
    expect(html).toContain("Fila &amp; 1");
  });

  it("passes an advanced HTML block through unchanged (escape hatch for old templates)", () => {
    expect(compileBlock({ id: "1", type: "html", html: "<p>raw <b>html</b></p>" })).toBe("<p>raw <b>html</b></p>");
  });
});

describe("compileBlocks + pipeline integration", () => {
  it("joins blocks and still renders through renderTemplate and htmlToPdfContent", () => {
    const blocks: Block[] = [
      defaultBlock("heading"),
      { id: "x", type: "text", text: "Cliente: {{contact.name}}", align: "left", bold: false, italic: false },
      { id: "y", type: "table", header: false, rows: [["a", "b"]] },
    ];
    const html = compileBlocks(blocks);
    const rendered = renderTemplate(html, { contact: { name: "Ana" } });
    expect(rendered.html).toContain("Cliente: Ana");
    expect(rendered.unknown).toEqual([]);
    expect(() => htmlToPdfContent(rendered.html)).not.toThrow();
  });
});

describe("availableBlockTypes", () => {
  it("only offers the quote tables inside the quote context", () => {
    expect(availableBlockTypes("quote")).toContain("quote_lines");
    expect(availableBlockTypes("contact")).not.toContain("quote_lines");
    expect(availableBlockTypes("case")).not.toContain("quote_totals");
  });
});

describe("blocksFromLegacyHtml", () => {
  it("wraps non-empty legacy HTML as a single editable block", () => {
    const blocks = blocksFromLegacyHtml("<h1>Vieja plantilla</h1>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "html", html: "<h1>Vieja plantilla</h1>" });
  });
  it("returns no blocks for empty or placeholder bodies", () => {
    expect(blocksFromLegacyHtml("")).toEqual([]);
    expect(blocksFromLegacyHtml("   ")).toEqual([]);
    expect(blocksFromLegacyHtml("<p></p>")).toEqual([]);
  });
});

describe("drag-and-drop reordering", () => {
  const list = (ids: string) => ids.split("").map((id) => ({ id, type: "divider" }) as Block);

  it("inserts a brand-new block at the drop index", () => {
    const result = insertBlockAt(list("abc"), 1, { id: "n", type: "divider" });
    expect(result.map((b) => b.id)).toEqual(["a", "n", "b", "c"]);
  });
  it("inserts at the start and past the end without throwing", () => {
    expect(insertBlockAt(list("ab"), 0, { id: "n", type: "divider" }).map((b) => b.id)).toEqual(["n", "a", "b"]);
    expect(insertBlockAt(list("ab"), 99, { id: "n", type: "divider" }).map((b) => b.id)).toEqual(["a", "b", "n"]);
  });

  it("moves a block forward to land right before the drop point", () => {
    // Dragging "a" to index 2 (between b and c) should end up between them.
    expect(moveBlockTo(list("abc"), "a", 2).map((b) => b.id)).toEqual(["b", "a", "c"]);
  });
  it("moves a block backward to the exact drop point", () => {
    expect(moveBlockTo(list("abc"), "c", 0).map((b) => b.id)).toEqual(["c", "a", "b"]);
  });
  it("dropping a block back onto its own slot is a no-op", () => {
    expect(moveBlockTo(list("abc"), "b", 1).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
  it("ignores a drag of an id that no longer exists", () => {
    expect(moveBlockTo(list("abc"), "zzz", 1).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});

describe("normalizeTableRows", () => {
  it("pads ragged rows to the widest row", () => {
    expect(normalizeTableRows([["a", "b", "c"], ["x"]])).toEqual([["a", "b", "c"], ["x", "", ""]]);
  });
  it("keeps at least one column", () => {
    expect(normalizeTableRows([[], []])).toEqual([[""], [""]]);
  });
});
