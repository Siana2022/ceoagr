import { z } from "zod";
import { slugify } from "@/lib/modules/format";
import type { PipelineStatus, SchemaField } from "./types";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

// ------------------------------------------------------------ case type

const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "boolean"] as const;

const fieldInput = z.object({
  key: z.string().optional(),
  label: z.string().trim().min(1, "Cada campo necesita un nombre").max(80),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});

const statusInput = z.object({
  key: z.string().optional(),
  label: z.string().trim().min(1, "Cada estado necesita un nombre").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
  initial: z.boolean().optional(),
  final: z.boolean().optional(),
});

function uniqueKeys<T extends { key?: string; label: string }>(items: T[], fallback: string) {
  const used = new Set<string>();
  return items.map((item) => {
    const base = item.key?.trim() || slugify(item.label) || fallback;
    let key = base;
    let n = 2;
    while (used.has(key)) key = `${base}_${n++}`;
    used.add(key);
    return { ...item, key };
  });
}

export const caseTypeSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre del tipo").max(80),
  label_singular: z.string().trim().min(1, "Indica la denominación en singular").max(40),
  label_plural: z.string().trim().min(1, "Indica la denominación en plural").max(40),
  code_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "El prefijo usa 2-8 letras o números"),
});

export function parseFields(json: string): { fields?: SchemaField[]; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return { error: "Campos personalizados no válidos" };
  }
  const parsed = z.array(fieldInput).max(30, "Máximo 30 campos").safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const withKeys = uniqueKeys(parsed.data, "campo");
  for (const f of withKeys) {
    if (f.type === "select" && !(f.options && f.options.length)) {
      return { error: `El campo «${f.label}» necesita al menos una opción` };
    }
  }
  return {
    fields: withKeys.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.type === "boolean" ? false : !!f.required,
      ...(f.type === "select" ? { options: f.options } : {}),
    })),
  };
}

export function parsePipeline(json: string): { pipeline?: PipelineStatus[]; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return { error: "Estados no válidos" };
  }
  const parsed = z
    .array(statusInput)
    .min(1, "Define al menos un estado")
    .max(20, "Máximo 20 estados")
    .safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const withKeys = uniqueKeys(parsed.data, "estado");
  const initials = withKeys.filter((s) => s.initial);
  if (initials.length > 1) return { error: "Solo un estado puede ser el inicial" };
  const initialKey = initials[0]?.key ?? withKeys[0].key;

  return {
    pipeline: withKeys.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      ...(s.key === initialKey ? { initial: true } : {}),
      ...(s.final ? { final: true } : {}),
    })),
  };
}

// ----------------------------------------------------------------- case

export const caseSchema = z.object({
  contact_id: z.uuid("Selecciona un contacto"),
  title: z.string().trim().min(1, "Indica el título").max(300),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  due_at: z
    .preprocess(
      emptyToNull,
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").nullish(),
    )
    .transform((v) => v ?? null),
  budget_hours: z
    .preprocess(
      (v) => (emptyToNull(v) === null ? null : Number(v)),
      z.number().min(0, "No puede ser negativo").max(100000).nullish(),
    )
    .transform((v) => v ?? null),
  owner_id: z
    .preprocess(emptyToNull, z.uuid().nullish())
    .transform((v) => v ?? null),
});

export type CaseInput = z.output<typeof caseSchema>;

export function caseFormToInput(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    contact_id: g("contact_id"),
    title: g("title"),
    priority: g("priority") || "normal",
    due_at: g("due_at"),
    budget_hours: g("budget_hours"),
    owner_id: g("owner_id"),
  };
}

// Validates custom field values against the case type's custom_schema.
export function parseCustomFields(fd: FormData, fields: SchemaField[]) {
  const shape: Record<string, z.ZodType> = {};
  const input: Record<string, unknown> = {};

  for (const f of fields) {
    const raw = fd.get(`cf_${f.key}`);
    input[f.key] = typeof raw === "string" ? raw : undefined;

    switch (f.type) {
      case "number":
        shape[f.key] = z
          .preprocess(
            (v) => (emptyToNull(v) === null || v === undefined ? null : Number(v)),
            z.number("Número no válido").nullish(),
          )
          .transform((v) => v ?? null);
        break;
      case "date":
        shape[f.key] = z
          .preprocess(
            emptyToNull,
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").nullish(),
          )
          .transform((v) => v ?? null);
        break;
      case "select": {
        const opts = f.options ?? [];
        shape[f.key] = z
          .preprocess(
            emptyToNull,
            z
              .string()
              .refine((v) => opts.includes(v), "Opción no válida")
              .nullish(),
          )
          .transform((v) => v ?? null);
        break;
      }
      case "boolean":
        shape[f.key] = z.preprocess((v) => v === "on" || v === "true", z.boolean());
        break;
      default:
        shape[f.key] = z
          .preprocess(emptyToNull, z.string().trim().max(5000).nullish())
          .transform((v) => v ?? null);
    }
  }

  const parsed = z.object(shape).safeParse(input);
  const errors: Record<string, string> = {};
  let values: Record<string, unknown> = {};

  if (parsed.success) {
    values = parsed.data;
  } else {
    for (const issue of parsed.error.issues) {
      errors[`cf_${String(issue.path[0])}`] ??= issue.message;
    }
  }
  for (const f of fields) {
    const v = values[f.key];
    if (parsed.success && f.required && (v === null || v === undefined || v === "")) {
      errors[`cf_${f.key}`] = `${f.label} es obligatorio`;
    }
  }
  return { values, errors };
}
