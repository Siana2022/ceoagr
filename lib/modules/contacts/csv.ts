// CSV parsing and contact row mapping for imports (pure, unit-tested).

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0].n > 0 ? counts.sort((a, b) => b.n - a.n)[0].d : ";";
}

// RFC 4180-style parser: quoted fields, escaped quotes, newlines inside quotes.
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type ImportField =
  | "kind" | "name" | "legal_name" | "tax_id" | "email" | "phone" | "mobile"
  | "street" | "postal_code" | "city" | "province" | "country" | "tags" | "source";

const ALIASES: Record<ImportField, string[]> = {
  kind: ["tipo", "type", "kind", "persona o empresa"],
  name: ["nombre", "name", "contacto", "cliente", "nombre completo", "nombre y apellidos"],
  legal_name: ["razon social", "legal name", "legal_name", "denominacion social"],
  tax_id: ["nif", "cif", "nif cif", "cif nif", "dni", "tax id", "tax_id", "identificacion fiscal"],
  email: ["email", "e mail", "correo", "correo electronico", "mail"],
  phone: ["telefono", "tel", "phone", "telefono fijo", "tfno"],
  mobile: ["movil", "mobile", "celular", "telefono movil"],
  street: ["calle", "direccion", "domicilio", "address", "street"],
  postal_code: ["cp", "codigo postal", "postal code", "postal_code", "c p"],
  city: ["ciudad", "localidad", "poblacion", "city"],
  province: ["provincia", "province"],
  country: ["pais", "country"],
  tags: ["etiquetas", "tags", "etiqueta", "categorias"],
  source: ["origen", "source", "procedencia", "fuente"],
};

export const TEMPLATE_HEADERS = [
  "Tipo", "Nombre", "Razón social", "NIF/CIF", "Email", "Teléfono", "Móvil",
  "Calle", "CP", "Ciudad", "Provincia", "País", "Etiquetas", "Origen",
];

export function mapHeaders(headers: string[]): { index: Partial<Record<ImportField, number>>; unknown: string[] } {
  const index: Partial<Record<ImportField, number>> = {};
  const unknown: string[] = [];
  headers.forEach((h, i) => {
    const key = strip(h);
    const field = (Object.keys(ALIASES) as ImportField[]).find((f) => ALIASES[f].includes(key));
    if (field && index[field] === undefined) index[field] = i;
    else if (key) unknown.push(h.trim());
  });
  return { index, unknown };
}

export function parseKind(v: string, hasLegalName: boolean): "person" | "company" {
  const s = strip(v);
  if (["empresa", "company", "sociedad", "juridica", "persona juridica", "e", "c"].includes(s)) return "company";
  if (["persona", "person", "fisica", "persona fisica", "particular", "p"].includes(s)) return "person";
  return hasLegalName ? "company" : "person";
}

export type RawContactRow = {
  line: number;
  kind: string; name: string; legal_name: string; tax_id: string; email: string; phone: string; mobile: string;
  source: string; tags: string;
  address: { street: string; postal_code: string; city: string; province: string; country: string };
};

export function rowsFromTable(table: string[][]): { rows: RawContactRow[]; unknownColumns: string[]; missingName: boolean } {
  if (table.length < 2) return { rows: [], unknownColumns: [], missingName: false };
  const { index, unknown } = mapHeaders(table[0]);
  const missingName = index.name === undefined && index.legal_name === undefined;
  const get = (cells: string[], f: ImportField) => (index[f] === undefined ? "" : (cells[index[f]!] ?? "").trim());

  const rows = table.slice(1).map((cells, i): RawContactRow => {
    const legal = get(cells, "legal_name");
    const name = get(cells, "name") || legal;
    return {
      line: i + 2,
      kind: parseKind(get(cells, "kind"), !!legal),
      name,
      legal_name: legal,
      tax_id: get(cells, "tax_id"),
      email: get(cells, "email"),
      phone: get(cells, "phone"),
      mobile: get(cells, "mobile"),
      source: get(cells, "source"),
      tags: get(cells, "tags").split(/[|,]/).map((t) => t.trim()).filter(Boolean).join(","),
      address: {
        street: get(cells, "street"),
        postal_code: get(cells, "postal_code"),
        city: get(cells, "city"),
        province: get(cells, "province"),
        country: get(cells, "country"),
      },
    };
  });
  return { rows, unknownColumns: unknown, missingName };
}
