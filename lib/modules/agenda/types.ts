export type ResourceKind = "professional" | "room" | "equipment";

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  professional: "Profesional",
  room: "Sala",
  equipment: "Equipo",
};

export type Resource = {
  id: string;
  name: string;
  kind: ResourceKind;
  color: string;
  active: boolean;
  public_booking: boolean;
  slot_minutes: number;
};

export type AvailabilityRule = {
  id: string;
  resource_id: string;
  weekday: number; // 0 = Sunday … 6 = Saturday
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  valid_from: string | null;
  valid_to: string | null;
};

export type AvailabilityException = {
  id: string;
  resource_id: string;
  date: string;
  reason: string | null;
};

export const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "no_show";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  no_show: "No se presentó",
};

export type Appointment = {
  id: string;
  resource_id: string;
  contact_id: string | null;
  case_id: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  title: string;
  notes: string | null;
  source: "internal" | "online";
  created_by: string | null;
};

export type AppointmentListItem = Appointment & {
  contacts: { name: string } | null;
  resources: { name: string; color: string } | null;
};

export type AgendaFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | undefined;
