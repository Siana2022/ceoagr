import { createClient } from "@/lib/supabase/server";

export type SearchGroup<T> = { items: T[]; count: number };

export type SearchResults = {
  q: string;
  contacts: SearchGroup<{ id: string; name: string; email: string | null; tax_id: string | null }>;
  cases: SearchGroup<{ id: string; code: string; title: string; contacts: { name: string } | null }>;
  tasks: SearchGroup<{ id: string; title: string; status: string; cases: { code: string } | null }>;
  opportunities: SearchGroup<{ id: string; title: string; stage: string; contacts: { name: string } | null }>;
  quotes: SearchGroup<{ id: string; number: string; title: string }>;
  documents: SearchGroup<{ id: string; name: string }>;
};

const clean = (v: string) => v.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();
const LIMIT = 6;

// Everything is read through the signed-in user's session, so RLS decides what appears.
export async function globalSearch(raw: string): Promise<SearchResults> {
  const q = clean(raw).slice(0, 80);
  const empty = { items: [], count: 0 };
  if (q.length < 2) {
    return { q, contacts: empty, cases: empty, tasks: empty, opportunities: empty, quotes: empty, documents: empty };
  }
  const like = `%${q}%`;
  const supabase = await createClient();

  const [contacts, cases, tasks, opps, quotes, docs] = await Promise.all([
    supabase.from("contacts").select("id, name, email, tax_id", { count: "exact" }).eq("archived", false)
      .or(`name.ilike.${like},email.ilike.${like},tax_id.ilike.${like},phone.ilike.${like},mobile.ilike.${like},legal_name.ilike.${like}`)
      .order("name").limit(LIMIT),
    supabase.from("cases").select("id, code, title, contacts(name)", { count: "exact" }).eq("archived", false)
      .or(`title.ilike.${like},code.ilike.${like}`).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("tasks").select("id, title, status, cases(code)", { count: "exact" })
      .ilike("title", like).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("opportunities").select("id, title, stage, contacts(name)", { count: "exact" }).eq("archived", false)
      .ilike("title", like).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("quotes").select("id, number, title", { count: "exact" })
      .or(`title.ilike.${like},number.ilike.${like}`).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("documents").select("id, name", { count: "exact" }).eq("archived", false)
      .ilike("name", like).order("created_at", { ascending: false }).limit(LIMIT),
  ]);

  const g = <T,>(r: { data: unknown; count: number | null }): SearchGroup<T> => ({
    items: (r.data ?? []) as T[],
    count: r.count ?? 0,
  });
  return {
    q,
    contacts: g(contacts),
    cases: g(cases),
    tasks: g(tasks),
    opportunities: g(opps),
    quotes: g(quotes),
    documents: g(docs),
  };
}
