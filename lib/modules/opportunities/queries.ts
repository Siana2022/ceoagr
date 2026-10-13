import { createClient } from "@/lib/supabase/server";
import type { Opportunity, OpportunityListItem, Quote, QuoteLine, Stage } from "./types";

const sanitize = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function normalizeOpp<T extends Record<string, unknown>>(r: T) {
  return { ...r, expected_value: num(r.expected_value) } as unknown as T & Opportunity;
}

export async function listOpportunities(opts: { q?: string; stage?: Stage; archived?: boolean; contactId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("opportunities")
    .select("*, contacts(name)")
    .eq("archived", opts.archived ?? false)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (opts.stage) query = query.eq("stage", opts.stage);
  if (opts.contactId) query = query.eq("contact_id", opts.contactId);
  if (opts.q) {
    const q = sanitize(opts.q);
    if (q) query = query.ilike("title", `%${q}%`);
  }
  const { data, error } = await query;
  const rows = ((data ?? []) as Record<string, unknown>[]).map(normalizeOpp) as unknown as OpportunityListItem[];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];
  const owners = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds);
    for (const p of profiles ?? []) owners.set(p.user_id, p.full_name);
  }
  return { rows, owners, error: error?.message ?? null };
}

export async function getOpportunity(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("*, contacts(id, name), cases(id, code)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { contacts, cases, ...rest } = normalizeOpp(data as Record<string, unknown>) as Opportunity & {
    contacts: { id: string; name: string } | null;
    cases: { id: string; code: string } | null;
  };

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, number, title, status, total, issue_date")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });

  let ownerName: string | null = null;
  if (rest.owner_id) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", rest.owner_id).maybeSingle();
    ownerName = p?.full_name ?? null;
  }
  return {
    opp: rest as Opportunity,
    contact: contacts,
    kase: cases,
    ownerName,
    quotes: ((quotes ?? []) as Record<string, unknown>[]).map((q) => ({ ...q, total: Number(q.total) })) as unknown as Pick<Quote, "id" | "number" | "title" | "status" | "total" | "issue_date">[],
  };
}

export async function getQuote(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("*, contacts(id, name, tax_id, email, address), opportunities(id, title, case_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { contacts, opportunities, ...q } = data as Record<string, unknown> & {
    contacts: { id: string; name: string; tax_id: string | null; email: string | null; address: Record<string, string> } | null;
    opportunities: { id: string; title: string; case_id: string | null } | null;
  };
  const quote = {
    ...q,
    tax_rate: Number(q.tax_rate),
    subtotal: Number(q.subtotal),
    total: Number(q.total),
    total_hours: Number(q.total_hours),
  } as unknown as Quote;

  const { data: lines } = await supabase
    .from("quote_lines")
    .select("*")
    .eq("quote_id", id)
    .order("position")
    .order("created_at");
  return {
    quote,
    contact: contacts,
    opportunity: opportunities,
    lines: ((lines ?? []) as Record<string, unknown>[]).map((l) => ({
      ...l,
      hours: num(l.hours),
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      amount: Number(l.amount),
    })) as unknown as QuoteLine[],
  };
}
