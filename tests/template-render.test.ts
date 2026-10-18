import { describe, expect, it } from "vitest";
import { Raw, chipifyVariables, renderTemplate } from "@/lib/modules/documents/render";
import { buildContext, quoteLinesHtml, sampleContext } from "@/lib/modules/documents/context";
import { STARTER_TEMPLATES, starterBody } from "@/lib/modules/documents/starters";
import { allVariableKeys, groupsFor } from "@/lib/modules/documents/variables";

describe("renderTemplate", () => {
  const ctx = { contact: { name: "Ana <b>López</b>", phone: null }, case: { code: "EXP-2026-0001", custom: { m2: 120 } }, org: { logo: new Raw('<img src="data:image/png;base64,AA==">') } };

  it("replaces variables and escapes HTML in values", () => {
    const r = renderTemplate("Hola {{ contact.name }} ({{case.code}}), {{case.custom.m2}} m²", ctx);
    expect(r.html).toBe("Hola Ana &lt;b&gt;López&lt;/b&gt; (EXP-2026-0001), 120 m²");
    expect(r.unknown).toEqual([]);
  });

  it("blanks null values and reports unknown variables", () => {
    const r = renderTemplate("{{contact.phone}}|{{contact.nope}}|{{__proto__.x}}", ctx);
    expect(r.html).toBe("||");
    expect(r.unknown).toEqual(["contact.nope", "__proto__.x"]);
  });

  it("inserts Raw values as markup and nothing else", () => {
    expect(renderTemplate("{{org.logo}}", ctx).html).toContain("<img");
    expect(renderTemplate("{{contact.name}}", { contact: { name: new Raw("<b>x</b>") } }).html).toBe("<b>x</b>");
  });

  it("drops editor chips and keeps the value", () => {
    const r = renderTemplate('<p>Hola <span data-var="contact.name" class="v">{{contact.name}}</span></p>', ctx);
    expect(r.html).toBe("<p>Hola Ana &lt;b&gt;López&lt;/b&gt;</p>");
  });

  it("turns plain variables into chips without double-wrapping", () => {
    const once = chipifyVariables("<p>{{contact.name}}</p>");
    expect(once).toBe('<p><span data-var="contact.name">{{contact.name}}</span></p>');
    expect(chipifyVariables(once)).toBe(once);
  });

  it("keeps line breaks of multi-line values", () => {
    expect(renderTemplate("{{a}}", { a: "uno\ndos" }).html).toBe("uno<br>dos");
  });
});

describe("template contexts", () => {
  it("builds quote tables and money formatting", () => {
    const ctx = buildContext({
      org: { name: "AGR" }, today: "15/10/2026",
      quote: { number: "PRES-1", title: "T", issue_date: "2026-10-15", valid_until: null, subtotal: 100, tax_rate: 21, total: 121, total_hours: 5, notes: null, lines: [{ description: "<x>", hours: 5, quantity: 1, unit_price: 100, amount: 100 }] },
    });
    const html = renderTemplate("{{quote.lines_table}}{{quote.total}}{{quote.tax}}", ctx).html;
    expect(html).toContain("&lt;x&gt;");
    expect(html).toMatch(/121,00/);
    expect(html).toMatch(/21,00/);
  });

  it("escapes lines and falls back for empty quotes", () => {
    expect(quoteLinesHtml([])).toContain("Sin líneas");
  });

  it("every starter template only uses known variables and renders with sample data", () => {
    const known = new Set(allVariableKeys());
    const ctx = sampleContext({ name: "AGR" }, "15/10/2026");
    for (const t of STARTER_TEMPLATES) {
      const body = starterBody(t);
      const used = [...body.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((m) => m[1]);
      expect(used.filter((k) => !known.has(k)), t.name).toEqual([]);
      expect(renderTemplate(body, ctx).unknown, t.name).toEqual([]);
    }
  });

  it("offers the right variable groups per context", () => {
    expect(groupsFor("quote").map((g) => g.id)).toContain("quote");
    expect(groupsFor("contact").map((g) => g.id)).not.toContain("quote");
    expect(groupsFor("general")).toHaveLength(6);
  });
});
