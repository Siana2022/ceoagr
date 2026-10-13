"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { slugify } from "@/lib/modules/format";
import {
  caseFormToInput,
  caseSchema,
  caseTypeSchema,
  parseCustomFields,
  parseFields,
  parsePipeline,
} from "./schema";
import { getCaseType } from "./queries";
import type { CaseFormState } from "./types";

function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

// ------------------------------------------------------------ case types

async function readCaseType(fd: FormData) {
  const base = caseTypeSchema.safeParse({
    name: fd.get("name"),
    label_singular: fd.get("label_singular"),
    label_plural: fd.get("label_plural"),
    code_prefix: fd.get("code_prefix"),
  });
  if (!base.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of base.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Revisa los campos marcados", fieldErrors } as const;
  }
  const fields = parseFields(String(fd.get("fields_json") ?? "[]"));
  if (fields.error) return { ok: false, error: fields.error } as const;
  const pipeline = parsePipeline(String(fd.get("pipeline_json") ?? "[]"));
  if (pipeline.error) return { ok: false, error: pipeline.error } as const;

  return { ok: true, base: base.data, fields: fields.fields!, pipeline: pipeline.pipeline! } as const;
}

export async function createCaseType(_prev: CaseFormState, fd: FormData): Promise<CaseFormState> {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) return { error: "Solo administradores pueden configurar tipos" };

  const r = await readCaseType(fd);
  if (!r.ok) return { error: r.error, fieldErrors: "fieldErrors" in r ? r.fieldErrors : undefined, values: formValues(fd) };

  const supabase = await createClient();
  const { error } = await supabase.from("case_types").insert({
    name: r.base.name,
    slug: slugify(r.base.name) || "tipo",
    label_singular: r.base.label_singular,
    label_plural: r.base.label_plural,
    code_prefix: r.base.code_prefix,
    custom_schema: r.fields,
    pipeline: r.pipeline,
  });
  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe un tipo con ese nombre" : "No se pudo crear el tipo",
      values: formValues(fd),
    };
  }
  redirect("/settings/case-types");
}

export async function updateCaseType(
  id: string,
  _prev: CaseFormState,
  fd: FormData,
): Promise<CaseFormState> {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) return { error: "Solo administradores pueden configurar tipos" };
  if (!z.uuid().safeParse(id).success) return { error: "Tipo no válido" };

  const r = await readCaseType(fd);
  if (!r.ok) return { error: r.error, fieldErrors: "fieldErrors" in r ? r.fieldErrors : undefined, values: formValues(fd) };

  const supabase = await createClient();

  // Statuses in use cannot disappear from the pipeline.
  const { data: used } = await supabase.from("cases").select("status").eq("case_type_id", id);
  const keys = new Set(r.pipeline.map((s) => s.key));
  const missing = [...new Set((used ?? []).map((c) => c.status))].find((s) => !keys.has(s));
  if (missing) {
    return {
      error: `El estado «${missing}» está en uso por algún expediente y no se puede quitar`,
      values: formValues(fd),
    };
  }

  const { data, error } = await supabase
    .from("case_types")
    .update({
      name: r.base.name,
      label_singular: r.base.label_singular,
      label_plural: r.base.label_plural,
      code_prefix: r.base.code_prefix,
      custom_schema: r.fields,
      pipeline: r.pipeline,
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) {
    return { error: "No se pudo guardar el tipo", values: formValues(fd) };
  }
  redirect("/settings/case-types");
}

export async function setCaseTypeArchived(id: string, archived: boolean) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role) || !z.uuid().safeParse(id).success) redirect("/settings/case-types");
  const supabase = await createClient();
  await supabase.from("case_types").update({ archived }).eq("id", id);
  redirect("/settings/case-types");
}

export async function archiveCaseType(id: string) {
  await setCaseTypeArchived(id, true);
}
export async function restoreCaseType(id: string) {
  await setCaseTypeArchived(id, false);
}

// ----------------------------------------------------------------- cases

function toRow(input: ReturnType<typeof caseSchema.parse>, includeOwner: boolean) {
  return {
    contact_id: input.contact_id,
    title: input.title,
    priority: input.priority,
    due_at: input.due_at,
    budget_hours: input.budget_hours,
    fee_amount: input.fee_amount,
    ...(includeOwner && input.owner_id ? { owner_id: input.owner_id } : {}),
  };
}

async function validate(fd: FormData, typeId: string) {
  const type = await getCaseType(typeId);
  if (!type) return { ok: false, error: "Tipo de expediente no válido" } as const;

  const base = caseSchema.safeParse(caseFormToInput(fd));
  const cf = parseCustomFields(fd, type.custom_schema);
  const fieldErrors: Record<string, string> = { ...cf.errors };
  if (!base.success) {
    for (const i of base.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  }
  if (!base.success || Object.keys(fieldErrors).length) {
    return { ok: false, error: "Revisa los campos marcados", fieldErrors } as const;
  }
  return { ok: true, base: base.data, custom: cf.values } as const;
}

export async function createCase(_prev: CaseFormState, fd: FormData): Promise<CaseFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para crear expedientes" };

  const typeId = String(fd.get("case_type_id") ?? "");
  if (!z.uuid().safeParse(typeId).success) return { error: "Tipo de expediente no válido" };

  const r = await validate(fd, typeId);
  if (!r.ok) return { error: r.error, fieldErrors: "fieldErrors" in r ? r.fieldErrors : undefined, values: formValues(fd) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .insert({
      ...toRow(r.base, isStaffRole(role)),
      case_type_id: typeId,
      custom_fields: r.custom,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo crear el expediente", values: formValues(fd) };
  redirect(`/cases/${data.id}`);
}

export async function updateCase(
  id: string,
  _prev: CaseFormState,
  fd: FormData,
): Promise<CaseFormState> {
  if (!z.uuid().safeParse(id).success) return { error: "Expediente no válido" };
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("cases")
    .select("case_type_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "Expediente no encontrado" };

  const r = await validate(fd, existing.case_type_id);
  if (!r.ok) return { error: r.error, fieldErrors: "fieldErrors" in r ? r.fieldErrors : undefined, values: formValues(fd) };

  const { data, error } = await supabase
    .from("cases")
    .update({ ...toRow(r.base, isStaffRole(role)), custom_fields: r.custom })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) {
    return { error: "No se pudo guardar. Puede que no tengas permiso.", values: formValues(fd) };
  }
  redirect(`/cases/${id}`);
}

export async function changeCaseStatus(id: string, fd: FormData) {
  if (!z.uuid().safeParse(id).success) redirect("/cases");
  const status = String(fd.get("status") ?? "");
  const back = String(fd.get("back") ?? "") === "board" ? "/cases?view=board" : `/cases/${id}`;
  const supabase = await createClient();
  await supabase.from("cases").update({ status }).eq("id", id);
  redirect(back);
}

async function setArchived(id: string, archived: boolean) {
  if (!z.uuid().safeParse(id).success) redirect("/cases");
  const supabase = await createClient();
  await supabase
    .from("cases")
    .update({ archived, archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  redirect(archived ? "/cases" : `/cases/${id}`);
}

export async function archiveCase(id: string) {
  await setArchived(id, true);
}
export async function restoreCase(id: string) {
  await setArchived(id, false);
}
