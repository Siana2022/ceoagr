import { z } from "zod";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optUuid = z.preprocess(emptyToNull, z.uuid("Valor no válido").nullish()).transform((v) => v ?? null);
const optDate = z
  .preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").nullish())
  .transform((v) => v ?? null);

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Indica el título").max(300),
  description: z
    .preprocess(emptyToNull, z.string().trim().max(5000).nullish())
    .transform((v) => v ?? null),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  assignee_id: optUuid,
  case_id: optUuid,
  contact_id: optUuid,
  start_at: optDate,
  due_at: optDate,
  estimate_minutes: z
    .preprocess(
      (v) => (emptyToNull(v) === null ? null : Number(v)),
      z.number().int("Debe ser un número entero").min(0).max(100000).nullish(),
    )
    .transform((v) => v ?? null),
});

export type TaskInput = z.output<typeof taskSchema>;

export function taskFormToInput(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    title: g("title"),
    description: g("description"),
    status: g("status") || "todo",
    priority: g("priority") || "normal",
    assignee_id: g("assignee_id"),
    case_id: g("case_id"),
    contact_id: g("contact_id"),
    start_at: g("start_at"),
    due_at: g("due_at"),
    estimate_minutes: g("estimate_minutes"),
  };
}
