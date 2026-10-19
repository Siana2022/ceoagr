import { z } from "zod";
import type { AutomationAction } from "./types";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

export const automationSchema = z.object({
  name: z.string().trim().min(1, "Indica el nombre").max(120),
  entity: z.enum(["case", "opportunity"]),
  case_type_id: z.preprocess(emptyToNull, z.uuid().nullish()).transform((v) => v ?? null),
  to_status: z.string().trim().min(1, "Elige el estado o fase que dispara la automatización").max(60),
  active: z.boolean(),
  create_task: z.boolean(),
  task_title: z.string().trim().max(200).optional(),
  task_assign_to: z.enum(["owner", "none"]),
  task_due_offset_days: z
    .preprocess((v) => (emptyToNull(v) === null ? null : Number(v)), z.number().int().min(0).max(3650).nullish())
    .transform((v) => v ?? null),
  task_priority: z.enum(["low", "normal", "high", "urgent"]),
  call_webhook: z.boolean(),
  webhook_url: z.preprocess(emptyToNull, z.url("La URL no es válida").nullish()).transform((v) => v ?? null),
}).superRefine((d, ctx) => {
  if (d.entity === "opportunity" && d.case_type_id) {
    ctx.addIssue({ code: "custom", path: ["case_type_id"], message: "El tipo de expediente solo aplica a expedientes" });
  }
  if (!d.create_task && !d.call_webhook) {
    ctx.addIssue({ code: "custom", path: ["create_task"], message: "Elige al menos una acción" });
  }
  if (d.create_task && !d.task_title) {
    ctx.addIssue({ code: "custom", path: ["task_title"], message: "Indica el título de la tarea" });
  }
  if (d.call_webhook && !d.webhook_url) {
    ctx.addIssue({ code: "custom", path: ["webhook_url"], message: "Indica la URL del webhook" });
  }
});

export type AutomationInput = z.output<typeof automationSchema>;

export function readAutomationForm(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return automationSchema.safeParse({
    name: g("name"),
    entity: g("entity") || "case",
    case_type_id: g("case_type_id"),
    to_status: g("to_status"),
    active: fd.get("active") === "on" || !fd.has("active_present"),
    create_task: fd.get("create_task") === "on",
    task_title: g("task_title"),
    task_assign_to: g("task_assign_to") === "none" ? "none" : "owner",
    task_due_offset_days: g("task_due_offset_days"),
    task_priority: (["low", "normal", "high", "urgent"] as const).includes(g("task_priority") as never)
      ? (g("task_priority") as "low" | "normal" | "high" | "urgent")
      : "normal",
    call_webhook: fd.get("call_webhook") === "on",
    webhook_url: g("webhook_url"),
  });
}

export function buildActions(d: AutomationInput): AutomationAction[] {
  const actions: AutomationAction[] = [];
  if (d.create_task) {
    actions.push({
      type: "create_task",
      title: d.task_title ?? "Tarea automática",
      assign_to: d.task_assign_to,
      due_offset_days: d.task_due_offset_days,
      priority: d.task_priority,
    });
  }
  if (d.call_webhook && d.webhook_url) {
    actions.push({ type: "webhook", url: d.webhook_url });
  }
  return actions;
}

// Splits stored actions back into form-friendly fields (for the edit form).
export function actionsToFormValues(actions: AutomationAction[]) {
  const task = actions.find((a): a is Extract<AutomationAction, { type: "create_task" }> => a.type === "create_task");
  const webhook = actions.find((a): a is Extract<AutomationAction, { type: "webhook" }> => a.type === "webhook");
  return {
    create_task: !!task,
    task_title: task?.title ?? "",
    task_assign_to: task?.assign_to ?? "owner",
    task_due_offset_days: task?.due_offset_days ?? null,
    task_priority: task?.priority ?? "normal",
    call_webhook: !!webhook,
    webhook_url: webhook?.url ?? "",
  };
}
