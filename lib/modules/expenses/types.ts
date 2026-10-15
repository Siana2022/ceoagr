export type ExpenseKind = "kilometraje" | "dieta" | "alojamiento" | "transporte" | "material" | "otros";
export type ExpenseStatus = "submitted" | "approved" | "rejected" | "reimbursed";

export const KIND_LABELS: Record<ExpenseKind, string> = {
  kilometraje: "Kilometraje",
  dieta: "Dieta",
  alojamiento: "Alojamiento",
  transporte: "Transporte",
  material: "Material",
  otros: "Otros",
};

export const STATUS_LABELS: Record<ExpenseStatus, string> = {
  submitted: "Pendiente de aprobar",
  approved: "Aprobado",
  rejected: "Rechazado",
  reimbursed: "Reembolsado",
};

export const STATUS_STYLE: Record<ExpenseStatus, string> = {
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-sky-100 text-sky-700",
  rejected: "bg-red-100 text-red-700",
  reimbursed: "bg-emerald-100 text-emerald-700",
};

export type ExpenseRates = { km_rate: number; dieta: number; dieta_overnight: number };

// Spanish tax-exempt limits (AEAT). Confirm with the company's tax advisor.
export const DEFAULT_RATES: ExpenseRates = { km_rate: 0.26, dieta: 26.67, dieta_overnight: 53.34 };

export type Expense = {
  id: string;
  user_id: string;
  case_id: string | null;
  expense_date: string;
  kind: ExpenseKind;
  description: string | null;
  quantity: number;
  unit_amount: number;
  amount: number;
  billable: boolean;
  receipt_path: string | null;
  status: ExpenseStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  reimbursed_at: string | null;
  created_at: string;
};

export type ExpenseListItem = Expense & { cases: { code: string } | null };

export type ExpenseFormState = { error?: string; ok?: boolean; values?: Record<string, string> } | undefined;

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
