export type AppRole = "owner" | "admin" | "manager" | "member" | "readonly";

export type NavItem = {
  href: string;
  label: string;
  ready: boolean;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Panel", ready: true },
  { href: "/contacts", label: "Contactos", ready: false },
  { href: "/cases", label: "Expedientes", ready: false },
  { href: "/tasks", label: "Tareas", ready: false },
  { href: "/calendar", label: "Agenda", ready: false },
  { href: "/documents", label: "Documentos", ready: false },
  { href: "/settings", label: "Ajustes", ready: true, adminOnly: true },
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
