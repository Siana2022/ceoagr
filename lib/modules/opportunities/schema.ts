import { z } from "zod";
import { isDateString } from "@/lib/modules/format";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const optText = z
  .preprocess(emptyToNull, z.string().trim().max(2000).nullish())
  .transform((v) => v ?? null);
const optNumber = (min: number, max: number, msg: string) =>
  z
    .preprocess(
      (v) => (v === undefined || emptyToNull(v) === null ? null : Number(String(v).replace(",", "."))),
      z.number(msg).min(min, msg).max(max, msg).nullish(),
    )
    .transform((v) => v ?? null);
const optDate = z
  .preprocess(emptyToNull, z.string().refine(isDateString, "Fecha no válida").nullish())
  .transform((v) => v ?? null);

export const opportunitySchema = z
  .object({
    contact_id: z.uuid("Selecciona un contacto"),
    title: z.string().trim().min(1, "Indica el título").max(300),
    stage: z.enum(["lead", "study", "quote_sent", "negotiation", "won", "lost"]),
    expected_value: optNumber(0, 1_000_000_000, "Importe no válido"),
    probability: optNumber(0, 100, "Debe estar entre 0 y 100").transform((v) => (v === null ? null : Math.round(v))),
    owner_id: z.preprocess(emptyToNull, z.uuid().nullish()).transform((v) => v ?? null),
    expected_close: optDate,
    source: optText,
    notes: optText,
    lost_reason: optText,
  })
  .superRefine((d, ctx) => {
    if (d.stage === "lost" && !d.lost_reason) {
      ctx.addIssue({ code: "custom", path: ["lost_reason"], message: "Indica el motivo de la pérdida" });
    }
  });

export type OpportunityInput = z.output<typeof opportunitySchema>;

export function opportunityFormToInput(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    contact_id: g("contact_id"),
    title: g("title"),
    stage: g("stage") || "lead",
    expected_value: g("expected_value"),
    probability: g("probability"),
    owner_id: g("owner_id"),
    expected_close: g("expected_close"),
    source: g("source"),
    notes: g("notes"),
    lost_reason: g("lost_reason"),
  };
}

export const quoteMetaSchema = z.object({
  title: z.string().trim().min(1, "Indica el título").max(300),
  valid_until: optDate,
  tax_rate: z.preprocess(
    (v) => Number(String(v ?? "21").replace(",", ".")),
    z.number("IVA no válido").min(0).max(100),
  ),
  notes: optText,
});

export const quoteLineSchema = z.object({
  description: z.string().trim().min(1, "Indica el concepto").max(500),
  hours: optNumber(0, 100000, "Horas no válidas"),
  quantity: z.preprocess(
    (v) => (v === undefined || v === "" ? 1 : Number(String(v).replace(",", "."))),
    z.number("Cantidad no válida").min(0).max(1_000_000),
  ),
  unit_price: z.preprocess(
    (v) => (v === undefined || v === "" ? 0 : Number(String(v).replace(",", "."))),
    z.number("Precio no válido").min(0).max(1_000_000_000),
  ),
});

export const lostSchema = z.object({
  lost_reason: z.string().trim().min(3, "Indica el motivo de la pérdida").max(500),
});
