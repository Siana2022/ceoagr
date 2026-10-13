import { createClient } from "@/lib/supabase/server";
import type { CaseEvent, CaseRow, CaseType, Priority } from "./types";

export const CASES_PAGE_SIZE = 25;
const MAX_PAGE = 400;
const KANBAN_LIMIT = 300;

const sanitize = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();

export async function listCaseTypes(includeArchived = false): Promise<CaseType[]> {
  const supabase = await createClient();
  let q = supabase.from("case_types").select("*").order("name");
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q;
  return (data ?? []) as CaseType[];
}

export async function getCaseType(id: string): Promise<CaseType | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("case_types").select("*").eq("id", id).maybeSingle();
  return (data as CaseType | null) ?? null;
}

export type CaseFilters = {
  q?: string;
  typeId?: string;
  contactId?: string;
  status?: string;
  archived?: boolean;
  sort?: "created_at" | "due_at" | "code";
  dir?: "asc" | "desc";
  page?: number;
  all?: boolean; // kanban: no pagination
};

export type CaseListItem = Pick<
  CaseRow,
  "id" | "code" | "title" | "status" | "priority" | "due_at" | "owner_id" | "archived" | "created_at" | "case_type_id"
> & { contacts: { name: string } | null };

export async function listCases(filters: CaseFilters) {
  const supabase = await createClient();
  const page = Math.min(Math.max(filters.page ?? 1, 1), MAX_PAGE);
  const from = (page - 1) * CASES_PAGE_SIZE;

  let query = supabase
    .from("cases")
    .select(
      "id, code, title, status, priority, due_at, owner_id, archived, created_at, case_type_id, contacts(name)",
      { count: "exact" },
    )
    .eq("archived", filters.archived ?? false)
    .order(filters.sort ?? "created_at", {
      ascending: (filters.dir ?? "desc") === "asc",
      nullsFirst: false,
    });

  query = filters.all
    ? query.limit(KANBAN_LIMIT)
    : query.range(from, from + CASES_PAGE_SIZE - 1);

  if (filters.typeId) query = query.eq("case_type_id", filters.typeId);
  if (filters.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) {
    const q = sanitize(filters.q);
    if (q) query = query.or(`title.ilike.%${q}%,code.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as CaseListItem[];

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

export async function getCase(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*, contacts(id, name), case_types(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const { contacts, case_types, ...rest } = data as CaseRow & {
    contacts: { id: string; name: string } | null;
    case_types: CaseType;
  };

  const { data: events } = await supabase
    .from("case_events")
    .select("id, event_type, actor_id, payload, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const userIds = new Set<string>();
  if (rest.owner_id) userIds.add(rest.owner_id);
  for (const e of events ?? []) if (e.actor_id) userIds.add(e.actor_id);
  const names = new Map<string, string>();
  if (userIds.size) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", [...userIds]);
    for (const p of profiles ?? []) names.set(p.user_id, p.full_name);
  }

  return {
    kase: rest as CaseRow,
    contact: contacts,
    type: case_types,
    events: (events ?? []) as CaseEvent[],
    names,
  };
}

export async function listContactOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("archived", false)
    .order("name")
    .limit(500);
  return (data ?? []) as { id: string; name: string }[];
}

export type { Priority };
