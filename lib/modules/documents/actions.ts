"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { safeBack } from "@/lib/modules/redirect";
import { fmtDate } from "@/lib/modules/format";
import { renderTemplate, wrapHtml } from "./render";
import { parseTags, safeFileName, storeFile } from "./storage";
import { BLOCKED_EXTENSIONS, MAX_FILE_BYTES, type DocFormState } from "./types";

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

export async function generateFromTemplate(fd: FormData) {
  const back = safeBack(fd, "/documents");
  const role = await getCurrentRole();
  const templateId = uuidOrNull(fd.get("template_id"));
  const caseId = uuidOrNull(fd.get("case_id"));
  const contactIdParam = uuidOrNull(fd.get("contact_id"));
  if (!role || !canWrite(role) || !templateId || (!caseId && !contactIdParam)) redirect(back);

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("document_templates")
    .select("name, body")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) redirect(back);

  let kase: Record<string, unknown> | null = null;
  let contactId = contactIdParam;
  if (caseId) {
    const { data } = await supabase
      .from("cases")
      .select("code, title, status, priority, due_at, contact_id, custom_fields, case_types(pipeline)")
      .eq("id", caseId)
      .maybeSingle();
    if (data) {
      const pipeline = ((data.case_types as unknown as { pipeline: { key: string; label: string }[] } | null)?.pipeline) ?? [];
      kase = {
        code: data.code,
        title: data.title,
        status: pipeline.find((s) => s.key === data.status)?.label ?? data.status,
        priority: data.priority,
        due_at: fmtDate(data.due_at),
        custom: data.custom_fields ?? {},
      };
      contactId = contactId ?? data.contact_id;
    }
  }

  let contact: Record<string, unknown> = {};
  if (contactId) {
    const { data } = await supabase.from("contacts").select("*").eq("id", contactId).maybeSingle();
    if (data) {
      const a = (data.address ?? {}) as Record<string, string>;
      contact = {
        name: data.name,
        legal_name: data.legal_name,
        tax_id: data.tax_id,
        email: data.email,
        phone: data.phone,
        mobile: data.mobile,
        address: [a.street, a.postal_code, a.city, a.province, a.country].filter(Boolean).join(", "),
      };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("name").maybeSingle(),
    user
      ? supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { html } = renderTemplate(template.body, {
    contact,
    case: kase ?? {},
    org: { name: org?.name ?? "" },
    user: { name: profile?.full_name ?? "" },
    today: fmtDate(new Date().toISOString()),
  });

  const title = `${template.name}${kase ? ` - ${kase.code}` : ""}`;
  const blob = new Blob([wrapHtml(title, html)], { type: "text/html" });
  const r = await storeFile({
    file: blob,
    fileName: `${title}.html`,
    contentType: "text/html",
    target: { caseId, contactId: caseId ? null : contactId },
    tags: ["generado"],
  });
  redirect(r.id ? `/documents/${r.id}` : back);
}

// ---------------------------------------------------------- templates CRUD

const templateSchema = z.object({
  name: z.string().trim().min(1, "Indica el nombre").max(120),
  body: z.string().max(200_000),
  case_type_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullish()).transform((v) => v ?? null),
});

function readTemplate(fd: FormData) {
  return templateSchema.safeParse({
    name: fd.get("name"),
    body: fd.get("body") ?? "",
    case_type_id: fd.get("case_type_id") ?? "",
  });
}

export async function createTemplate(_prev: DocFormState, fd: FormData): Promise<DocFormState> {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) return { error: "No tienes permiso" };
  const parsed = readTemplate(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("document_templates").insert({ ...parsed.data, kind: "html" });
  if (error) return { error: "No se pudo crear la plantilla" };
  redirect("/settings/templates");
}

export async function updateTemplate(id: string, _prev: DocFormState, fd: FormData): Promise<DocFormState> {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role) || !z.uuid().safeParse(id).success) return { error: "No tienes permiso" };
  const parsed = readTemplate(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("document_templates").update(parsed.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: "No se pudo guardar la plantilla" };
  redirect("/settings/templates");
}

export async function deleteTemplate(id: string) {
  const role = await getCurrentRole();
  if (role && isStaffRole(role) && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("document_templates").delete().eq("id", id);
  }
  redirect("/settings/templates");
}
