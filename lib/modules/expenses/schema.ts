import { z } from "zod";
import { isDateString } from "@/lib/modules/format";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const num = (v: unknown) => (v === undefined || emptyToNull(v) === null ? null : Number(String(v).replace(",", ".")));

export const expenseSchema = z
  .object({
    kind: z.enum(["kilometraje", "dieta", "alojamiento", "transporte", "material", "otros"]),
    expense_date: z.string().refine(isDateString, "Fecha no válida"),
    case_id: z.preprocess(emptyToNull, z.uuid("Expediente no válido").nullish()).transform((v) => v ?? null),
    description: z
      .preprocess(emptyToNull, z.string().trim().max(500).nullish())
      .transform((v) => v ?? null),
    km: z.preprocess(num, z.number("Kilómetros no válidos").min(0.1).max(5000, "Máximo 5.000 km").nullish()).transform((v) => v ?? null),
    days: z.preprocess(num, z.number("Días no válidos").int("Debe ser un número entero").min(1).max(31).nullish()).transform((v) => v ?? null),
    overnight: z.boolean(),
    amount: z.preprocess(num, z.number("Importe no válido").min(0.01, "Importe no válido").max(100000, "Importe demasiado alto").nullish()).transform((v) => v ?? null),
    billable: z.boolean(),
  })
  .superRefine((d, ctx) => {
    const need = (cond: boolean, path: string, message: string) => {
      if (!cond) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (d.kind === "kilometraje") need(d.km !== null, "km", "Indica los kilómetros");
    else if (d.kind === "dieta") need(d.days !== null, "days", "Indica los días");
    else need(d.amount !== null, "amount", "Indica el importe");

    const today = new Date().toISOString().slice(0, 10);
    need(d.expense_date <= today, "expense_date", "La fecha no puede ser futura");
  });

export type ExpenseParsed = z.output<typeof expenseSchema>;

export function expenseFormToInput(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    kind: g("kind"),
    expense_date: g("expense_date"),
    case_id: g("case_id"),
    description: g("description"),
    km: g("km"),
    days: g("days"),
    overnight: fd.get("overnight") === "on",
    amount: g("amount"),
    billable: fd.get("billable") === "on",
  };
}

export const ratesSchema = z.object({
  km_rate: z.preprocess(num, z.number().min(0).max(5)),
  dieta: z.preprocess(num, z.number().min(0).max(500)),
  dieta_overnight: z.preprocess(num, z.number().min(0).max(500)),
});

export const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "reimbursed"]),
  note: z.string().trim().max(500).optional(),
});
