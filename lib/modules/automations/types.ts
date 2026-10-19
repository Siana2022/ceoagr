export type AutomationEntity = "case" | "opportunity";

export type CreateTaskAction = {
  type: "create_task";
  title: string;
  description?: string;
  assign_to: "owner" | "none";
  due_offset_days: number | null;
  priority: "low" | "normal" | "high" | "urgent";
};

export type WebhookAction = {
  type: "webhook";
  url: string;
};

export type AutomationAction = CreateTaskAction | WebhookAction;

export type Automation = {
  id: string;
  name: string;
  entity: AutomationEntity;
  case_type_id: string | null;
  to_status: string;
  actions: AutomationAction[];
  active: boolean;
  created_at: string;
};

export type AutomationRun = {
  id: string;
  automation_id: string | null;
  entity: string;
  entity_id: string;
  action_type: string;
  status: "ok" | "error";
  detail: string | null;
  created_at: string;
};

export type AutomationFormState =
  | { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | undefined;
