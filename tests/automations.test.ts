import { describe, expect, it } from "vitest";
import { actionsToFormValues, automationSchema, buildActions, readAutomationForm } from "@/lib/modules/automations/schema";
import type { AutomationAction } from "@/lib/modules/automations/types";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const base = {
  name: "Al cerrar",
  entity: "case",
  to_status: "cerrado",
  create_task: "on",
  task_title: "Archivar expediente",
  task_assign_to: "owner",
  task_priority: "normal",
};

describe("automationSchema / readAutomationForm", () => {
  it("accepts a minimal create-task automation", () => {
    const r = readAutomationForm(fd(base));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(buildActions(r.data)).toEqual([
        { type: "create_task", title: "Archivar expediente", assign_to: "owner", due_offset_days: null, priority: "normal" },
      ]);
    }
  });

  it("requires at least one action", () => {
    const r = readAutomationForm(fd({ ...base, create_task: "" }));
    expect(r.success).toBe(false);
  });

  it("requires a title when create_task is checked", () => {
    const r = readAutomationForm(fd({ ...base, task_title: "" }));
    expect(r.success).toBe(false);
  });

  it("requires a valid URL when call_webhook is checked", () => {
    expect(readAutomationForm(fd({ ...base, call_webhook: "on", webhook_url: "" })).success).toBe(false);
    expect(readAutomationForm(fd({ ...base, call_webhook: "on", webhook_url: "not a url" })).success).toBe(false);
    expect(readAutomationForm(fd({ ...base, call_webhook: "on", webhook_url: "https://n8n.example.com/hook" })).success).toBe(true);
  });

  it("rejects a case_type_id on an opportunity automation", () => {
    const r = automationSchema.safeParse({
      ...base,
      entity: "opportunity",
      case_type_id: "00000000-0000-4000-8000-000000000001",
      active: true,
      task_due_offset_days: null,
      call_webhook: false,
      webhook_url: null,
    });
    expect(r.success).toBe(false);
  });

  it("combines both actions in order", () => {
    const r = readAutomationForm(fd({ ...base, call_webhook: "on", webhook_url: "https://n8n.example.com/hook" }));
    expect(r.success && buildActions(r.data).map((a) => a.type)).toEqual(["create_task", "webhook"]);
  });

  it("parses the due offset and clamps missing/invalid values", () => {
    const ok = readAutomationForm(fd({ ...base, task_due_offset_days: "3" }));
    expect(ok.success && ok.data.task_due_offset_days).toBe(3);
    expect(readAutomationForm(fd({ ...base, task_due_offset_days: "-1" })).success).toBe(false);
  });
});

describe("actionsToFormValues", () => {
  it("round-trips a create_task action", () => {
    const actions: AutomationAction[] = [{ type: "create_task", title: "x", assign_to: "none", due_offset_days: 5, priority: "high" }];
    expect(actionsToFormValues(actions)).toMatchObject({ create_task: true, task_title: "x", task_assign_to: "none", task_due_offset_days: 5, task_priority: "high", call_webhook: false });
  });
  it("round-trips a webhook action", () => {
    const actions: AutomationAction[] = [{ type: "webhook", url: "https://x.test" }];
    expect(actionsToFormValues(actions)).toMatchObject({ call_webhook: true, webhook_url: "https://x.test", create_task: false });
  });
  it("defaults sensibly when there are no actions", () => {
    expect(actionsToFormValues([])).toMatchObject({ create_task: false, call_webhook: false, task_assign_to: "owner", task_priority: "normal" });
  });
});
