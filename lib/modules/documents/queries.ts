import { createClient } from "@/lib/supabase/server";
import type { DocumentRow, Template } from "./types";

export const DOCS_PAGE_SIZE = 25;
const sanitize = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();

export type DocFilters = {
  caseId?: string;
  contactId?: string;
  q?: string;
  tag?: string;
  archived?: boolean;
  page?: number;
  limit?: number;
};

export type DocListItem = DocumentRow & {
  cases: { code: string } | null;
  contacts: { name: string } | null;
};

export async function listDocuments(f: DocFilters) {
  const supabase = await createClient();
  const page = Math.max(f.page ?? 1, 1);
  const size = f.limit ?? DOCS_PAGE_SIZE;
  const from = (page - 1) * size;

  // Only the latest version of each document is listed.
  const { data: parents } = await supabase
    .from("documents")
    .select("parent_document_id")
    .not("parent_document_id", "is", null)
    .limit(2000);
  const superseded = [...new Set((parents ?? []).map((p) => p.parent_document_id as string))];

  let query = supabase
    .from("documents")
    .select("*, cases(code), contacts(name)", { count: "exact" })
    .eq("archived", f.archived ?? false)
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);

  if (superseded.length) query = query.not("id", "in", `(${superseded.join(",")})`);
  if (f.caseId) query = query.eq("case_id", f.caseId);
  if (f.contactId) query = query.eq("contact_id", f.contactId);
  if (f.tag) query = query.contains("tags", [f.tag]);
  if (f.q) {
    const q = sanitize(f.q);
    if (q) query = query.ilike("name", `%${q}%`);
  }

  const { data, count, error } = await query;
  return {
    rows: (data ?? []) as unknown as DocListItem[],
    total: count ?? 0,
    page,
    error: error?.message ?? null,
  };
}

export async function getDocument(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*, cases(id, code), contacts(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { cases, contacts, ...doc } = data as DocumentRow & {
    cases: { id: string; code: string } | null;
    contacts: { id: string; name: string } | null;
  };

  const [{ data: previous }, { data: newer }] = await Promise.all([
    doc.parent_document_id
      ? supabase.from("documents").select("id, version, created_at").eq("id", doc.parent_document_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("documents").select("id, version").eq("parent_document_id", id).limit(1),
  ]);

  let previewUrl: string | null = null;
  if (doc.mime_type?.startsWith("image/") || doc.mime_type === "application/pdf") {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 120);
    previewUrl = signed?.signedUrl ?? null;
  }

  return {
    doc: doc as DocumentRow,
    kase: cases,
    contact: contacts,
    previous: previous as { id: string; version: number; created_at: string } | null,
    newer: (newer ?? [])[0] as { id: string; version: number } | undefined,
    previewUrl,
  };
}

export async function listTemplates(contexts?: Template["context"][]): Promise<Template[]> {
  const supabase = await createClient();
  let q = supabase.from("document_templates").select("*").order("is_default", { ascending: false }).order("name");
  if (contexts?.length) q = q.in("context", contexts);
  const { data } = await q;
  return (data ?? []) as Template[];
}

export async function getTemplate(id: string): Promise<Template | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("document_templates").select("*").eq("id", id).maybeSingle();
  return (data as Template | null) ?? null;
}
