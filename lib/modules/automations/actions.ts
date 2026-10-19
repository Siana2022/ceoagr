"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { buildActions, readAutomationForm } from "./schema";
import type { AutomationFormState } from "./types";

async function requireAdmin() {
  const role = await getCurrentRole();
  return !!role && isAdminRole(role);
}

function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export async function createAutomation(_prev: AutomationFormState, fd: FormData): Promise<AutomationFormState> {
  if (!(await requireAdmin())) return { error: "No tienes permiso para crear automatizaciones" };

  const parsed = readAutomationForm(fd);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Revisa los campos marcados", fieldErrors, values: formValues(fd) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("automations").insert({
    name: parsed.data.name,
    entity: parsed.data.entity,
    case_type_id: parsed.data.entity === "case" ? parsed.data.case_type_id : null,
    to_status: parsed.data.to_status,
    active: parsed.data.active,
    actions: buildActions(parsed.data),
  });
  if (error) return { error: "No se pudo crear la automatización", values: formValues(fd) };
  redirect("/settings/automations?saved=1");
}

export async function updateAutomation(id: string, _prev: AutomationFormState, fd: FormData): Promise<AutomationFormState> {
  if (!(await requireAdmin())) return { error: "No tienes permiso" };
  if (!z.uuid().safeParse(id).success) return { error: "Automatización no válida" };

  const parsed = readAutomationForm(fd);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Revisa los campos marcados", fieldErrors, values: formValues(fd) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .update({
      name: parsed.data.name,
      entity: parsed.data.entity,
      case_type_id: parsed.data.entity === "case" ? parsed.data.case_type_id : null,
      to_status: parsed.data.to_status,
      active: parsed.data.active,
      actions: buildActions(parsed.data),
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "No se pudo guardar la automatización", values: formValues(fd) };
  redirect("/settings/automations?saved=1");
}

export async function setAutomationActive(id: string, active: boolean) {
  if ((await requireAdmin()) && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("automations").update({ active }).eq("id", id);
  }
  redirect("/settings/automations");
}

export async function deleteAutomation(id: string) {
  if ((await requireAdmin()) && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("automations").delete().eq("id", id);
  }
  redirect("/settings/automations");
}

export async function regenerateWebhookSecret() {
  if (await requireAdmin()) {
    const supabase = await createClient();
    await supabase.rpc("regenerate_automation_secret");
  }
  redirect("/settings/automations?secret_regenerated=1");
}
