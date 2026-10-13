import { describe, expect, it } from "vitest";
import { renderTemplate, wrapHtml } from "@/lib/modules/documents/render";

describe("renderTemplate", () => {
  const ctx = { contact: { name: "Ana <b>López</b>", phone: null }, case: { code: "EXP-2026-0001", custom: { m2: 120 } } };

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

  it("wraps fragments in a full document once", () => {
    expect(wrapHtml("T", "<p>x</p>")).toContain("<!doctype html>");
    const full = "<html><body>x</body></html>";
    expect(wrapHtml("T", full)).toBe(full);
  });
});
