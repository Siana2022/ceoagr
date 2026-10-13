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
