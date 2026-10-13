"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { readTemplateForm } from "./schema";

async function guard(typeId: string) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role) || !z.uuid().safeParse(typeId).success) {
    redirect("/settings");
  }
}

const back = (typeId: string, q: string) => `/settings/case-types/${typeId}/tasks?${q}`;

export async function createTaskTemplate(typeId: string, fd: FormData) {
  await guard(typeId);
  const parsed = readTemplateForm(fd);
  if (!parsed.success) redirect(back(typeId, `error=${encodeURIComponent(parsed.error.issues[0].message)}`));

  const supabase = await createClient();
  const { count } = await supabase
    .from("case_task_templates")
    .select("*", { count: "exact", head: true })
    .eq("case_type_id", typeId)
    .eq("status_key", parsed.data.status_key);
  const { error } = await supabase
    .from("case_task_templates")
    .insert({ ...parsed.data, case_type_id: typeId, position: count ?? 0 });
  redirect(back(typeId, error ? "error=No se pudo guardar la tarea" : "saved=1"));
}

export async function updateTaskTemplate(typeId: string, id: string, fd: FormData) {
  await guard(typeId);
  if (!z.uuid().safeParse(id).success) redirect(back(typeId, "error=Tarea no válida"));
  const parsed = readTemplateForm(fd);
  if (!parsed.success) {
    redirect(`/settings/case-types/${typeId}/tasks/${id}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("case_task_templates").update(parsed.data).eq("id", id);
  redirect(back(typeId, error ? "error=No se pudo guardar la tarea" : "saved=1"));
}

export async function setTaskTemplateActive(typeId: string, id: string, active: boolean) {
  await guard(typeId);
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("case_task_templates").update({ active }).eq("id", id);
  }
  redirect(back(typeId, "saved=1"));
}

export async function deleteTaskTemplate(typeId: string, id: string) {
  await guard(typeId);
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("case_task_templates").delete().eq("id", id);
  }
  redirect(back(typeId, "saved=1"));
}
