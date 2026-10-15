import { describe, expect, it } from "vitest";
import { detectDelimiter, mapHeaders, parseCsv, parseKind, rowsFromTable } from "@/lib/modules/contacts/csv";
import { completeness, findDuplicateGroups, normEmail, normPhone, normTaxId, type DupContact } from "@/lib/modules/contacts/dedupe";
import { buildContactSchema } from "@/lib/modules/contacts/schema";
import { csvCell } from "@/lib/modules/time/calc";

describe("parseCsv", () => {
  it("detects the delimiter", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter("solo")).toBe(";");
  });
  it("handles quotes, escaped quotes, embedded newlines and BOM", () => {
    const t = parseCsv('﻿Nombre;Nota\r\n"Ana; López";"dice ""hola""\ny adiós"\r\nLuis;ok\r\n');
    expect(t).toEqual([["Nombre", "Nota"], ["Ana; López", 'dice "hola"\ny adiós'], ["Luis", "ok"]]);
  });
  it("skips blank lines and keeps empty cells", () => {
    expect(parseCsv("a;b;c\n\n1;;3\n")).toEqual([["a", "b", "c"], ["1", "", "3"]]);
  });
  it("round-trips with csvCell", () => {
    const cells = ["=cmd", 'a "q" b', "x;y", "plain"];
    const line = cells.map(csvCell).join(";");
    expect(parseCsv(line, ";")[0]).toEqual(["'=cmd", 'a "q" b', "x;y", "plain"]);
  });
});

describe("header and row mapping", () => {
  it("understands Spanish aliases, accents and case", () => {
    const { index, unknown } = mapHeaders(["Razón Social", "NIF/CIF", "E-mail", "Móvil", "CP", "Rareza"]);
    expect(index).toMatchObject({ legal_name: 0, tax_id: 1, email: 2, mobile: 3, postal_code: 4 });
    expect(unknown).toEqual(["Rareza"]);
  });
  it("infers kind and falls back to the legal name", () => {
    expect(parseKind("Empresa", false)).toBe("company");
    expect(parseKind("", true)).toBe("company");
    expect(parseKind("", false)).toBe("person");
    expect(parseKind("Persona física", true)).toBe("person");
  });
  it("builds rows with line numbers and normalized tags", () => {
    const t = parseCsv("Nombre;Email;Etiquetas;Ciudad\nAna;a@b.com;vip|obras;Valencia\n;;;\nLuis;;;Madrid");
    const { rows, missingName } = rowsFromTable(t);
    expect(missingName).toBe(false);
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
    expect(rows[0]).toMatchObject({ name: "Ana", email: "a@b.com", tags: "vip,obras", address: { city: "Valencia" } });
  });
  it("flags a file without name column", () => {
    expect(rowsFromTable(parseCsv("Email\na@b.com")).missingName).toBe(true);
  });
  it("rows validate against the contact schema", () => {
    const { rows } = rowsFromTable(parseCsv("Nombre;Email\nAna;mal\nLuis;l@x.com"));
    const schema = buildContactSchema([]);
    const res = rows.map((r) => schema.safeParse({ ...r, kind: r.kind }));
    expect(res.map((x) => x.success)).toEqual([false, true]);
  });
});

describe("normalizers", () => {
  it("normalizes email, phone and tax id", () => {
    expect(normEmail(" Ana@Mail.COM ")).toBe("ana@mail.com");
    expect(normEmail("no-email")).toBe("");
    expect(normPhone("+34 600 11 22 33")).toBe("600112233");
    expect(normPhone("0034600112233")).toBe("600112233");
    expect(normPhone("600-112-233")).toBe("600112233");
    expect(normPhone("123")).toBe("");
    expect(normTaxId("b-12.345.678")).toBe("B12345678");
    expect(normTaxId("12")).toBe("");
  });
});

const c = (id: string, name: string, o: Partial<DupContact> = {}): DupContact => ({
  id, name, email: null, phone: null, mobile: null, tax_id: null, created_at: `2026-01-0${id}T00:00:00Z`, ...o,
});

describe("findDuplicateGroups", () => {
  it("groups by shared email, phone or tax id", () => {
    const groups = findDuplicateGroups([
      c("1", "Ana", { email: "ana@x.com" }),
      c("2", "ANA LÓPEZ", { email: "ANA@x.com" }),
      c("3", "Luis", { phone: "600 11 22 33" }),
      c("4", "Luis G.", { mobile: "+34600112233" }),
      c("5", "Sociedad", { tax_id: "B-123.45" }),
      c("6", "Sociedad SL", { tax_id: "b12345" }),
      c("7", "Único", { email: "solo@x.com" }),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.contacts.map((x) => x.id).join()).sort()).toEqual(["1,2", "3,4", "5,6"]);
    expect(groups.find((g) => g.contacts[0].id === "1")?.reasons).toEqual(["email"]);
  });
  it("links groups transitively and combines reasons", () => {
    const groups = findDuplicateGroups([
      c("1", "A", { email: "a@x.com" }),
      c("2", "B", { email: "a@x.com", tax_id: "B12345" }),
      c("3", "C", { tax_id: "B12345" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].contacts).toHaveLength(3);
    expect([...groups[0].reasons].sort()).toEqual(["email", "tax_id"]);
  });
  it("ignores empty or too-short values and orders by age", () => {
    expect(findDuplicateGroups([c("1", "A", { phone: "12" }), c("2", "B", { phone: "12" }), c("3", "C"), c("4", "D")])).toEqual([]);
    const g = findDuplicateGroups([c("2", "Nuevo", { email: "a@x.com" }), c("1", "Viejo", { email: "a@x.com" })]);
    expect(g[0].contacts[0].name).toBe("Viejo");
  });
  it("scores completeness", () => {
    expect(completeness(c("1", "A", { email: "a@x.com", tax_id: "B12345" }))).toBe(2);
  });
});
