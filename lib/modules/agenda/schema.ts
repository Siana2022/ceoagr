import { z } from "zod";
import { isDateString, madridToUtc } from "@/lib/modules/format";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optUuid = z.preprocess(emptyToNull, z.uuid("Valor no válido").nullish()).transform((v) => v ?? null);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida");

export const appointmentSchema = z
  .object({
    title: z.string().trim().min(1, "Indica el título").max(200),
    resource_id: z.uuid("Selecciona un recurso"),
    contact_id: optUuid,
    case_id: optUuid,
    date: z.string().refine(isDateString, "Fecha no válida"),
    start: time,
    end: time,
    status: z.enum(["pending", "confirmed", "cancelled", "no_show"]),
    notes: z
      .preprocess(emptyToNull, z.string().trim().max(5000).nullish())
      .transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.start && d.end && d.end <= d.start) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "La hora de fin debe ser posterior al inicio" });
    }
  });

export type AppointmentInput = z.output<typeof appointmentSchema>;

export function appointmentFormToInput(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    title: g("title"),
    resource_id: g("resource_id"),
    contact_id: g("contact_id"),
    case_id: g("case_id"),
    date: g("date"),
    start: g("start"),
    end: g("end"),
    status: g("status") || "pending",
    notes: g("notes"),
  };
}

export function toAppointmentRow(d: AppointmentInput) {
  return {
    title: d.title,
    resource_id: d.resource_id,
    contact_id: d.contact_id,
    case_id: d.case_id,
    status: d.status,
    notes: d.notes,
    starts_at: madridToUtc(d.date, d.start).toISOString(),
    ends_at: madridToUtc(d.date, d.end).toISOString(),
  };
}

export const resourceSchema = z.object({
  name: z.string().trim().min(1, "Indica el nombre").max(80),
  kind: z.enum(["professional", "room", "equipment"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
  slot_minutes: z.preprocess((v) => Number(v), z.number().int().min(5).max(480)),
});

export const availabilityRuleSchema = z.object({
  weekday: z.preprocess((v) => Number(v), z.number().int().min(0).max(6)),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
}).refine((d) => d.end_time > d.start_time, { message: "La hora de fin debe ser posterior al inicio", path: ["end_time"] });

export const availabilityExceptionSchema = z.object({
  date: z.string().refine(isDateString, "Fecha no válida"),
  reason: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(200).nullish()).transform((v) => v ?? null),
});
