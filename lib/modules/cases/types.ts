export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto",
  textarea: "Texto largo",
  number: "Número",
  date: "Fecha",
  select: "Lista de opciones",
  boolean: "Sí / No",
};

export type SchemaField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
};

export type PipelineStatus = {
  key: string;
  label: string;
  color: string;
  initial?: boolean;
  final?: boolean;
};

export type Priority = "low" | "normal" | "high" | "urgent";

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export type CaseType = {
  id: string;
  name: string;
  slug: string;
  label_singular: string;
  label_plural: string;
  code_prefix: string;
  custom_schema: SchemaField[];
  pipeline: PipelineStatus[];
  archived: boolean;
};

export type CaseRow = {
  id: string;
  contact_id: string;
  case_type_id: string;
  code: string;
  title: string;
  status: string;
  priority: Priority;
  owner_id: string | null;
  opened_at: string;
  due_at: string | null;
  closed_at: string | null;
  custom_fields: Record<string, unknown>;
  budget_hours: number | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CaseEvent = {
  id: string;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type CaseFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | undefined;
