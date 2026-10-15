import { createClient } from "@/lib/supabase/server";
import type { Contact, ContactKind, ContactListItem } from "./types";

export const PAGE_SIZE = 25;
const MAX_PAGE = 400;

export type ContactFilters = {
  q?: string;
  kind?: ContactKind;
  tag?: string;
  archived?: boolean;
  sort?: "name" | "created_at";
  dir?: "asc" | "desc";
  page?: number;
};

// PostgREST filter strings treat these characters as syntax.
const sanitize = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();

export async function getRequiredFields(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .maybeSingle();
  const fields = data?.settings?.contacts?.required_fields;
  return Array.isArray(fields) ? fields : [];
}

export async function listContacts(filters: ContactFilters) {
  const supabase = await createClient();
  const page = Math.min(Math.max(filters.page ?? 1, 1), MAX_PAGE);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("contacts")
    .select("id, kind, name, email, phone, tags, owner_id, archived, created_at", {
      count: "exact",
    })
    .eq("archived", filters.archived ?? false)
    .order(filters.sort ?? "name", { ascending: (filters.dir ?? "asc") === "asc" })
    .range(from, from + PAGE_SIZE - 1);

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.q) {
    const q = sanitize(filters.q);
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,email.ilike.%${q}%,tax_id.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`,
      );
    }
  }

  const { data, count, error } = await query;
  const rows = (data ?? []) as ContactListItem[];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];
  const owners = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ownerIds);
    for (const p of profiles ?? []) owners.set(p.user_id, p.full_name);
  }

  return { rows, total: count ?? 0, page, owners, error: error?.message ?? null };
}

export async function getContact(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  let ownerName: string | null = null;
  if (data.owner_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", data.owner_id)
      .maybeSingle();
    ownerName = profile?.full_name ?? null;
  }
  return { contact: data as Contact, ownerName };
}

export async function listDuplicateCandidates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, name, email, phone, mobile, tax_id, created_at")
    .eq("archived", false)
    .limit(10000);
  return (data ?? []) as {
    id: string; name: string; email: string | null; phone: string | null; mobile: string | null; tax_id: string | null; created_at: string;
  }[];
}

// Exact (case-insensitive) matches used to warn before creating a duplicate.
export async function findSimilarContacts(input: { email: string | null; tax_id: string | null; phone: string | null; mobile: string | null }) {
  const supabase = await createClient();
  const esc = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();
  const parts: string[] = [];
  if (input.email) parts.push(`email.ilike.${esc(input.email)}`);
  if (input.tax_id) parts.push(`tax_id.ilike.${esc(input.tax_id)}`);
  for (const p of [input.phone, input.mobile]) if (p) parts.push(`phone.eq.${esc(p)}`, `mobile.eq.${esc(p)}`);
  if (!parts.length) return [];
  const { data } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("archived", false)
    .or(parts.join(","))
    .limit(5);
  return (data ?? []) as { id: string; name: string }[];
}

export const RELATION_TYPES = [
  "Empleado de",
  "Representante legal de",
  "Socio de",
  "Cónyuge de",
  "Familiar de",
  "Propietario de",
  "Proveedor de",
  "Cliente de",
];

export type RelationItem = { id: string; otherId: string; otherName: string; label: string };

export async function listRelations(contactId: string): Promise<RelationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_relations")
    .select("id, contact_id, related_contact_id, relation_type")
    .or(`contact_id.eq.${contactId},related_contact_id.eq.${contactId}`)
    .order("created_at");
  const rows = (data ?? []) as { id: string; contact_id: string; related_contact_id: string; relation_type: string }[];
  const otherIds = [...new Set(rows.map((r) => (r.contact_id === contactId ? r.related_contact_id : r.contact_id)))];
  const names = new Map<string, string>();
  if (otherIds.length) {
    const { data: contacts } = await supabase.from("contacts").select("id, name").in("id", otherIds);
    for (const c of contacts ?? []) names.set(c.id, c.name);
  }
  return rows.map((r) => {
    const outgoing = r.contact_id === contactId;
    const otherId = outgoing ? r.related_contact_id : r.contact_id;
    const otherName = names.get(otherId) ?? "Contacto no visible";
    return { id: r.id, otherId, otherName, label: outgoing ? r.relation_type : `${r.relation_type} este contacto` };
  });
}

export async function listContactShares(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("record_shares")
    .select("id, user_id, permission")
    .eq("entity", "contact")
    .eq("entity_id", contactId);
  const rows = (data ?? []) as { id: string; user_id: string; permission: "view" | "edit" }[];
  const names = new Map<string, string>();
  if (rows.length) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", rows.map((r) => r.user_id));
    for (const p of profiles ?? []) names.set(p.user_id, p.full_name);
  }
  return rows.map((r) => ({ ...r, name: names.get(r.user_id) ?? "Usuario" }));
}
