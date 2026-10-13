export type AppRole = "owner" | "admin" | "manager" | "member" | "readonly";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  ready: boolean;
  staffOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: "dashboard", label: "Panel", ready: true },
  { href: "/contacts", icon: "contacts", label: "Contactos", ready: true },
  { href: "/cases", icon: "cases", label: "Expedientes", ready: true },
  { href: "/tasks", icon: "tasks", label: "Tareas", ready: true },
  { href: "/calendar", icon: "calendar", label: "Agenda", ready: true },
  { href: "/documents", icon: "documents", label: "Documentos", ready: true },
  { href: "/settings", icon: "settings", label: "Ajustes", ready: true, staffOnly: true },
];

export function isAdminRole(role: AppRole) {
  return role === "owner" || role === "admin";
}

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  manager: "Responsable",
  member: "Miembro",
  readonly: "Solo lectura",
};

export function isStaffRole(role: AppRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canWrite(role: AppRole) {
  return role !== "readonly";
}
