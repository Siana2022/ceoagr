import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/modules/format";

export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  return { base: slugify(base, 60) || "archivo", ext };
}

export function parseTags(v: FormDataEntryValue | null) {
  return typeof v === "string"
    ? v.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20)
    : [];
}

export type Target = { caseId: string | null; contactId: string | null };

export async function storeFile(opts: {
  file: Blob;
  fileName: string;
  contentType: string;
  target: Target;
  tags: string[];
  version?: number;
  parentId?: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { error: "No se pudo determinar la organización" };

  const { base, ext } = safeFileName(opts.fileName);
  const entity = opts.target.caseId ? "case" : opts.target.contactId ? "contact" : "general";
  const entityId = opts.target.caseId ?? opts.target.contactId ?? "general";
  const path = `org/${orgId}/${entity}/${entityId}/${randomUUID()}-${base}${ext ? `.${ext}` : ""}`;

  const { error: upError } = await supabase.storage
    .from("documents")
    .upload(path, opts.file, { contentType: opts.contentType, upsert: false });
  if (upError) return { error: "No se pudo subir el archivo" };

  const { data, error } = await supabase
    .from("documents")
    .insert({
      case_id: opts.target.caseId,
      contact_id: opts.target.contactId,
      name: opts.fileName,
      storage_path: path,
      mime_type: opts.contentType,
      size_bytes: opts.file.size,
      version: opts.version ?? 1,
      parent_document_id: opts.parentId ?? null,
      tags: opts.tags,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "No se pudo registrar el documento. Puede que no tengas permiso." };
  }
  return { id: data.id };
}

