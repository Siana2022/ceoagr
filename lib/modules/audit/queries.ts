import { createClient } from "@/lib/supabase/server";

export const AUDIT_PAGE_SIZE = 50;

export type AuditRow = {
  id: string;
  actor_id: string | null;
  entity: string;
  entity_id: string;
  action: string;
  diff: Record<string, unknown>;
  created_at: string;
};

export type AuditFilters = {
  entity?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  fromIso?: string;
  toIso?: string;
  page?: number;
};

export async function listAudit(f: AuditFilters) {
  const supabase = await createClient();
  const page = Math.min(Math.max(f.page ?? 1, 1), 400);
  const from = (page - 1) * AUDIT_PAGE_SIZE;

  let q = supabase
    .from("audit_log")
    .select("id, actor_id, entity, entity_id, action, diff, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);
  if (f.entity) q = q.eq("entity", f.entity);
  if (f.entityId) q = q.eq("entity_id", f.entityId);
  if (f.action) q = q.eq("action", f.action);
  if (f.actorId) q = q.eq("actor_id", f.actorId);
  if (f.fromIso) q = q.gte("created_at", f.fromIso);
  if (f.toIso) q = q.lt("created_at", f.toIso);

  const { data, count, error } = await q;
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0, page, error: error?.message ?? null };
}
