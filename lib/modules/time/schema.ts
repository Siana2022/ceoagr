import { z } from "zod";
import { isDateString, madridToUtc } from "@/lib/modules/format";
import { parseDuration } from "./calc";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const optUuid = z.preprocess(emptyToNull, z.uuid("Valor no válido").nullish()).transform((v) => v ?? null);
const optText = z
  .preprocess(emptyToNull, z.string().trim().max(1000).nullish())
  .transform((v) => v ?? null);

export const startSchema = z.object({
  case_id: optUuid,
  task_id: optUuid,
  description: optText,
  billable: z.boolean(),
});

export const manualEntrySchema = z
  .object({
    case_id: optUuid,
    task_id: optUuid,
    description: optText,
    billable: z.boolean(),
    date: z.string().refine(isDateString, "Fecha no válida"),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
    duration: z.string().transform((v, ctx) => {
      const m = parseDuration(v);
      if (m === null) {
        ctx.addIssue({ code: "custom", message: "Duración no válida (ej. 1:30, 1,5 o 90m)" });
        return z.NEVER;
      }
      return m;
    }),
  })
  .transform((d) => ({
    case_id: d.case_id,
    task_id: d.task_id,
    description: d.description,
    billable: d.billable,
    minutes: d.duration,
    started_at: madridToUtc(d.date, d.start).toISOString(),
  }));

export const rateSchema = z.object({
  user_id: z.uuid("Elige una persona"),
  cost_per_hour: z.preprocess((v) => Number(String(v).replace(",", ".")), z.number().min(0).max(10000)),
  price_per_hour: z.preprocess((v) => Number(String(v).replace(",", ".")), z.number().min(0).max(10000)),
  valid_from: z.string().refine(isDateString, "Fecha no válida"),
});

export function parseThresholds(raw: string): number[] | null {
  const values = raw
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number);
  if (!values.length || values.length > 6) return null;
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 500)) return null;
  return [...new Set(values)].sort((a, b) => a - b);
}
