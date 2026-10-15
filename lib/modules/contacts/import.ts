"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { parseCsv, rowsFromTable, type RawContactRow } from "./csv";
import { contactKeys } from "./dedupe";
import { buildContactSchema } from "./schema";
import { getRequiredFields } from "./queries";
import type { ImportPreviewRow, ImportState } from "./types";

const MAX_ROWS = 2000;
const MAX_BYTES = 5 * 1024 * 1024;
const BATCH = 200;

async function existingKeys() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, name, email, phone, mobile, tax_id")
    .eq("archived", false)
    .limit(20000);
  const map = new Map<string, string>();
  for (const c of data ?? []) {
    for (const k of contactKeys(c)) if (!map.has(k.key)) map.set(k.key, c.name);
  }
  return map;
}

function toSchemaInput(r: RawContactRow) {
  return { ...r, address: { ...r.address } };
}

export async function previewImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para importar contactos" };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo CSV" };
  if (file.size > MAX_BYTES) return { error: "El archivo supera los 5 MB" };

  const text = await file.text();
  if (text.includes("�")) {
    return { error: "El archivo no está en UTF-8. En Excel: Guardar como → «CSV UTF-8 (delimitado por comas)»." };
  }
  const { rows, unknownColumns, missingName } = rowsFromTable(parseCsv(text));
  if (missingName) return { error: "No encuentro la columna del nombre. Usa la plantilla de ejemplo." };
  if (rows.length === 0) return { error: "El archivo no tiene filas de datos." };
  if (rows.length > MAX_ROWS) return { error: `Máximo ${MAX_ROWS} filas por importación (el archivo tiene ${rows.length}).` };

  const [required, existing] = await Promise.all([getRequiredFields(), existingKeys()]);
  const schema = buildContactSchema(required);
  const seen = new Map<string, number>();

  const preview: ImportPreviewRow[] = [];
  const valid: RawContactRow[] = [];
  for (const r of rows) {
    const parsed = schema.safeParse(toSchemaInput(r));
    const base = { line: r.line, name: r.name, email: r.email, tax_id: r.tax_id, phone: r.phone || r.mobile };
    if (!parsed.success) {
      preview.push({ ...base, status: "error", messages: [...new Set(parsed.error.issues.map((i) => i.message))] });
      continue;
    }
    const keys = contactKeys({ email: parsed.data.email, phone: parsed.data.phone, mobile: parsed.data.mobile, tax_id: parsed.data.tax_id });
    const inDb = keys.map((k) => existing.get(k.key)).find(Boolean);
    const inFile = keys.map((k) => seen.get(k.key)).find((v) => v !== undefined);
    keys.forEach((k) => { if (!seen.has(k.key)) seen.set(k.key, r.line); });

    if (inDb) preview.push({ ...base, status: "duplicate", messages: [`Ya existe: ${inDb}`] });
    else if (inFile !== undefined) preview.push({ ...base, status: "duplicate", messages: [`Repetido en la línea ${inFile}`] });
    else preview.push({ ...base, status: "ok", messages: [] });
    valid.push(r);
  }

  const dupLines = new Set(preview.filter((p) => p.status === "duplicate").map((p) => p.line));
  return {
    preview: {
      total: rows.length,
      valid: preview.filter((p) => p.status === "ok").length,
      invalid: preview.filter((p) => p.status === "error").length,
      duplicates: dupLines.size,
      unknownColumns,
      rows: preview,
      payload: JSON.stringify(valid.map((r) => ({ ...r, dup: dupLines.has(r.line) }))),
    },
  };
}

export async function confirmImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para importar contactos" };

  let raw: (RawContactRow & { dup?: boolean })[];
  try {
    raw = JSON.parse(String(fd.get("payload") ?? "[]"));
    if (!Array.isArray(raw) || raw.length > MAX_ROWS) throw new Error("bad payload");
  } catch {
    return { error: "No se pudo leer la vista previa. Vuelve a subir el archivo." };
  }
  const skipDuplicates = fd.get("skip_duplicates") === "on";

  // Never trust the client: validate again and recompute duplicates.
  const [required, existing] = await Promise.all([getRequiredFields(), existingKeys()]);
  const schema = buildContactSchema(required);
  const seen = new Set<string>();
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const r of raw) {
    const parsed = schema.safeParse(toSchemaInput(r));
    if (!parsed.success) { skipped += 1; continue; }
    const keys = contactKeys({ email: parsed.data.email, phone: parsed.data.phone, mobile: parsed.data.mobile, tax_id: parsed.data.tax_id });
    const isDup = keys.some((k) => existing.has(k.key) || seen.has(k.key));
    keys.forEach((k) => seen.add(k.key));
    if (isDup && skipDuplicates) { skipped += 1; continue; }

    const { address, ...rest } = parsed.data;
    toInsert.push({ ...rest, address: Object.fromEntries(Object.entries(address).filter(([, v]) => v)) });
  }

  const supabase = await createClient();
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("contacts").insert(chunk);
    if (error) {
      return { error: `Se importaron ${inserted} contactos y falló el lote siguiente. Revisa el archivo y vuelve a intentarlo (los ya importados se omitirán como duplicados).`, result: { inserted, skipped } };
    }
    inserted += chunk.length;
  }
  return { result: { inserted, skipped } };
}
