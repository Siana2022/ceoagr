export type DocumentRow = {
  id: string;
  case_id: string | null;
  contact_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  parent_document_id: string | null;
  tags: string[];
  archived: boolean;
  created_at: string;
  created_by: string | null;
};

export type Template = {
  id: string;
  name: string;
  kind: "html" | "docx";
  body: string;
  case_type_id: string | null;
  created_at: string;
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const BLOCKED_EXTENSIONS = ["exe", "bat", "cmd", "com", "scr", "msi", "sh", "ps1", "vbs", "jar"];

export type DocFormState = { error?: string; values?: Record<string, string> } | undefined;

export function formatBytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
