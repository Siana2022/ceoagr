"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { safeBack } from "@/lib/modules/redirect";
import { manualEntrySchema, parseThresholds, rateSchema, startSchema } from "./schema";
import type { TimeFormState } from "./types";

function values(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

// If a task is chosen without a case, the entry inherits the task's case.
async function resolveCase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string | null,
  taskId: string | null,
) {
  if (caseId || !taskId) return caseId;
  const { data } = await supabase.from("tasks").select("case_id").eq("id", taskId).maybeSingle();
  return data?.case_id ?? null;
}

export async function startTimer(fd: FormData) {
  const back = safeBack(fd, "/time");
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect(back);

  const parsed = startSchema.safeParse({
    case_id: fd.get("case_id") ?? "",
    task_id: fd.get("task_id") ?? "",
    description: fd.get("description") ?? "",
    billable: fd.get("billable") === "on",
  });
  if (!parsed.success) redirect(`${back}${back.includes("?") ? "&" : "?"}error=1`);

  const supabase = await createClient();
  const caseId = await resolveCase(supabase, parsed.data.case_id, parsed.data.task_id);
  const { error } = await supabase.from("time_entries").insert({
    ...parsed.data,
    case_id: caseId,
    started_at: new Date().toISOString(),
  });
  redirect(error ? `${back}${back.includes("?") ? "&" : "?"}error=running` : back);
}

export async function stopTimer(fd: FormData) {
  const back = safeBack(fd, "/time");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("time_entries")
      .update({ ended_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("ended_at", null);
  }
  redirect(back);
}

export async function addManualEntry(_prev: TimeFormState, fd: FormData): Promise<TimeFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para imputar horas" };

  const parsed = manualEntrySchema.safeParse({
    case_id: fd.get("case_id") ?? "",
    task_id: fd.get("task_id") ?? "",
    description: fd.get("description") ?? "",
    billable: fd.get("billable") === "on",
    date: fd.get("date") ?? "",
    start: fd.get("start") ?? "",
    duration: fd.get("duration") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: values(fd) };

  const supabase = await createClient();
  const caseId = await resolveCase(supabase, parsed.data.case_id, parsed.data.task_id);
  const { error } = await supabase.from("time_entries").insert({ ...parsed.data, case_id: caseId });
  if (error) return { error: "No se pudo guardar. Comprueba que tienes acceso al expediente.", values: values(fd) };
  return { ok: true };
}

export async function deleteEntry(id: string, fd: FormData) {
  const back = safeBack(fd, "/time");
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("time_entries").delete().eq("id", id);
  }
  redirect(back);
}

// ----------------------------------------------------------- settings

export async function saveRate(fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const parsed = rateSchema.safeParse({
    user_id: fd.get("user_id"),
    cost_per_hour: fd.get("cost_per_hour"),
    price_per_hour: fd.get("price_per_hour"),
    valid_from: fd.get("valid_from"),
  });
  if (!parsed.success) redirect("/settings/rates?error=1");
  const supabase = await createClient();
  const { error } = await supabase
    .from("member_rates")
    .upsert(parsed.data, { onConflict: "user_id,valid_from" });
  redirect(error ? "/settings/rates?error=1" : "/settings/rates?saved=1");
}

export async function deleteRate(id: string) {
  const role = await getCurrentRole();
  if (role && isAdminRole(role) && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("member_rates").delete().eq("id", id);
  }
  redirect("/settings/rates?saved=1");
}

export async function saveAlertThresholds(fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const values = parseThresholds(String(fd.get("thresholds") ?? ""));
  if (!values) redirect("/settings?error=1");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_time_alert_thresholds", { p_values: values });
  redirect(error ? "/settings?error=1" : "/settings?saved=1");
}

// ------------------------------------------------------ notifications

export async function markNotificationRead(id: string) {
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }
  redirect("/notifications");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  redirect("/notifications");
}
