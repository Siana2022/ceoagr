import { z } from "zod";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

export const ASSIGN_LABELS = {
  owner: "Responsable del expediente",
  actor: "Quien cambia de fase",
  none: "Sin asignar",
} as const;

export const templateSchema = z.object({
  status_key: z.string().min(1, "Elige la fase").max(60),
  title: z.string().trim().min(1, "Indica el título").max(300),
  description: z
    .preprocess(emptyToNull, z.string().trim().max(2000).nullish())
    .transform((v) => v ?? null),
  assign_to: z.enum(["owner", "actor", "none"]),
  due_offset_days: z
    .preprocess(
      (v) => (emptyToNull(v) === null ? null : Number(v)),
      z.number().int("Debe ser un número entero").min(0).max(3650).nullish(),
    )
    .transform((v) => v ?? null),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  checklist: z
    .string()
    .max(4000)
    .transform((v) =>
      v.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30),
    ),
  active: z.boolean(),
});

export function readTemplateForm(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return templateSchema.safeParse({
    status_key: g("status_key"),
    title: g("title"),
    description: g("description"),
    assign_to: g("assign_to") || "owner",
    due_offset_days: g("due_offset_days"),
    priority: g("priority") || "normal",
    checklist: g("checklist"),
    active: fd.get("active") === "on" || !fd.has("active_present"),
  });
}
