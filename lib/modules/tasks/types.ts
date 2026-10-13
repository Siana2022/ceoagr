import type { Priority } from "@/lib/modules/cases/types";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Pendiente",
  in_progress: "En curso",
  done: "Hecha",
  cancelled: "Cancelada",
};

export type Task = {
  id: string;
  case_id: string | null;
  contact_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee_id: string | null;
  start_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  estimate_minutes: number | null;
  created_at: string;
  created_by: string | null;
};

export type ChecklistItem = {
  id: string;
  task_id: string;
  label: string;
  done: boolean;
  position: number;
};

export type TaskFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | undefined;
