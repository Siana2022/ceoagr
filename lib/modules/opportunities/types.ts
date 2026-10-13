export type Stage = "lead" | "study" | "quote_sent" | "negotiation" | "won" | "lost";

export const STAGES: { key: Stage; label: string; color: string; probability: number }[] = [
  { key: "lead", label: "Consulta", color: "#64748b", probability: 10 },
  { key: "study", label: "Estudio / visita", color: "#0369a1", probability: 30 },
  { key: "quote_sent", label: "Presupuesto enviado", color: "#7c3aed", probability: 50 },
  { key: "negotiation", label: "Negociación", color: "#d97706", probability: 70 },
  { key: "won", label: "Ganada", color: "#15803d", probability: 100 },
  { key: "lost", label: "Perdida", color: "#dc2626", probability: 0 },
];

export const OPEN_STAGES: Stage[] = ["lead", "study", "quote_sent", "negotiation"];

export type Opportunity = {
  id: string;
  contact_id: string;
  title: string;
  stage: Stage;
  expected_value: number | null;
  probability: number | null;
  owner_id: string | null;
  expected_close: string | null;
  source: string | null;
  lost_reason: string | null;
  notes: string | null;
  case_id: string | null;
  closed_at: string | null;
  archived: boolean;
  created_at: string;
};

export type OpportunityListItem = Opportunity & { contacts: { name: string } | null };

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Caducado",
};

export type Quote = {
  id: string;
  opportunity_id: string | null;
  contact_id: string;
  number: string;
  title: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string | null;
  notes: string | null;
  tax_rate: number;
  subtotal: number;
  total: number;
  total_hours: number;
  owner_id: string | null;
};

export type QuoteLine = {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  hours: number | null;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type OppFormState =
  | { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | undefined;
