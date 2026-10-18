"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { safeBack } from "@/lib/modules/redirect";
import { parseTags, safeFileName, storeFile } from "./storage";
import { BLOCKED_EXTENSIONS, MAX_FILE_BYTES, type DocFormState } from "./types";
import { generatePdfDocument } from "./generate";
import { readTemplateForm } from "./template-schema";
import { STARTER_TEMPLATES, starterBody } from "./starters";

const uuidOrNull = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return z.uuid().safeParse(s).success ? s : null;
};

function validateFile(file: FormDataEntryValue | null): { file?: File; error?: string } {
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo" };
  if (file.size > MAX_FILE_BYTES) return { error: "El archivo supera los 20 MB" };
  const { ext } = safeFileName(file.name);
  if (BLOCKED_EXTENSIONS.includes(ext)) return { error: "Este tipo de archivo no está permitido" };
  return { file };
}

export async function uploadDocument(_prev: DocFormState, fd: FormData): Promise<DocFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para subir documentos" };

  const v = validateFile(fd.get("file"));
  if (!v.file) return { error: v.error };

  const r = await storeFile({
    file: v.file,
    fileName: v.file.name,
    contentType: v.file.type || "application/octet-stream",
    target: { caseId: uuidOrNull(fd.get("case_id")), contactId: uuidOrNull(fd.get("contact_id")) },
    tags: parseTags(fd.get("tags")),
  });
  if (r.error) return { error: r.error };
  redirect(safeBack(fd, `/documents/${r.id}`));
}

export async function uploadNewVersion(parentId: string, _prev: DocFormState, fd: FormData): Promise<DocFormState> {
  if (!z.uuid().safeParse(parentId).success) return { error: "Documento no válido" };
  const v = validateFile(fd.get("file"));
  if (!v.file) return { error: v.error };

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("documents")
    .select("id, case_id, contact_id, version, tags")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return { error: "Documento no encontrado" };
  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("parent_document_id", parentId);
  if (count) return { error: "Ya existe una versión más reciente de este documento" };

  const r = await storeFile({
    file: v.file,
    fileName: v.file.name,
    contentType: v.file.type || "application/octet-stream",
    target: { caseId: parent.case_id, contactId: parent.contact_id },
    tags: parent.tags ?? [],
    version: parent.version + 1,
    parentId,
  });
  if (r.error) return { error: r.error };
  redirect(`/documents/${r.id}`);
}

async function setArchived(id: string, archived: boolean) {
  if (!z.uuid().safeParse(id).success) redirect("/documents");
  const supabase = await createClient();
  await supabase
    .from("documents")
    .update({ archived, archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  redirect(archived ? "/documents" : `/documents/${id}`);
}
export async function archiveDocument(id: string) {
  await setArchived(id, true);
}
export async function restoreDocument(id: string) {
  await setArchived(id, false);
}

// ------------------------------------------------------ from a template

// Renders a template (PDF) for a case and/or contact and files it under Documentos.
export async function generateFromTemplate(fd: FormData) {
  const back = safeBack(fd, "/documents");
  const role = await getCurrentRole();
  const templateId = uuidOrNull(fd.get("template_id"));
  const caseId = uuidOrNull(fd.get("case_id"));
  const contactId = uuidOrNull(fd.get("contact_id"));
  if (!role || !canWrite(role) || !templateId || (!caseId && !contactId)) redirect(back);

  const r = await generatePdfDocument({ templateId, caseId, contactId });
  const sep = back.includes("?") ? "&" : "?";
  redirect(r.documentId ? `/documents/${r.documentId}` : `${back}${sep}error=${encodeURIComponent(r.error ?? "No se pudo generar el documento")}`);
}

// ---------------------------------------------------------- templates CRUD

async function staffOnly() {
  const role = await getCurrentRole();
  return !!role && isStaffRole(role);
}

async function clearOtherDefaults(context: string, keepId: string | null) {
  const supabase = await createClient();
  let q = supabase.from("document_templates").update({ is_default: false }).eq("context", context).eq("is_default", true);
  if (keepId) q = q.neq("id", keepId);
  await q;
}

export async function saveTemplate(id: string | null, _prev: DocFormState, fd: FormData): Promise<DocFormState> {
  if (!(await staffOnly())) return { error: "No tienes permiso" };
  if (id && !z.uuid().safeParse(id).success) return { error: "Plantilla no válida" };

  const parsed = readTemplateForm(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const t = parsed.data;

  const supabase = await createClient();
  const row = {
    name: t.name,
    description: t.description,
    context: t.context,
    body: t.body,
    blocks: t.blocks,
    page_settings: t.page_settings,
    is_default: false,
    kind: "html" as const,
  };

  let savedId = id;
  if (id) {
    const { data, error } = await supabase.from("document_templates").update(row).eq("id", id).select("id");
    if (error || !data?.length) return { error: "No se pudo guardar la plantilla" };
  } else {
    const { data, error } = await supabase.from("document_templates").insert(row).select("id").single();
    if (error || !data) return { error: "No se pudo crear la plantilla" };
    savedId = data.id;
  }

  if (t.is_default && savedId) {
    await clearOtherDefaults(t.context, savedId);
    await supabase.from("document_templates").update({ is_default: true }).eq("id", savedId);
  }
  redirect("/settings/templates?saved=1");
}

export async function setDefaultTemplate(id: string) {
  if ((await staffOnly()) && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    const { data } = await supabase.from("document_templates").select("context").eq("id", id).maybeSingle();
    if (data) {
      await clearOtherDefaults(data.context, id);
      await supabase.from("document_templates").update({ is_default: true }).eq("id", id);
    }
  }
  redirect("/settings/templates?saved=1");
}

export async function duplicateTemplate(id: string) {
  if ((await staffOnly()) && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    const { data } = await supabase.from("document_templates").select("*").eq("id", id).maybeSingle();
    if (data) {
      await supabase.from("document_templates").insert({
        name: `${data.name} (copia)`,
        description: data.description,
        context: data.context,
        body: data.body,
        blocks: data.blocks,
        page_settings: data.page_settings,
        kind: "html",
        is_default: false,
      });
    }
  }
  redirect("/settings/templates?saved=1");
}

export async function deleteTemplate(id: string) {
  if ((await staffOnly()) && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("document_templates").delete().eq("id", id);
  }
  redirect("/settings/templates");
}

export async function createStarterTemplates() {
  if (await staffOnly()) {
    const supabase = await createClient();
    const { data: existing } = await supabase.from("document_templates").select("name");
    const have = new Set((existing ?? []).map((t) => t.name));
    for (const t of STARTER_TEMPLATES.filter((x) => !have.has(x.name))) {
      await supabase.from("document_templates").insert({ ...t, body: starterBody(t), kind: "html" });
    }
  }
  redirect("/settings/templates?saved=1");
}
