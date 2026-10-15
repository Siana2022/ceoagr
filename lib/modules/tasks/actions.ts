"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { safeBack } from "@/lib/modules/redirect";
import { taskFormToInput, taskSchema } from "./schema";
import type { TaskFormState } from "./types";

function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function parse(fd: FormData) {
  const parsed = taskSchema.safeParse(taskFormToInput(fd));
  if (parsed.success) return { ok: true, data: parsed.data } as const;
  const fieldErrors: Record<string, string> = {};
  for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return {
    ok: false,
    state: { error: "Revisa los campos marcados", fieldErrors, values: formValues(fd) },
  } as const;
}

export async function createTask(_prev: TaskFormState, fd: FormData): Promise<TaskFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para crear tareas" };

  const r = parse(fd);
  if (!r.ok) return r.state;

  const supabase = await createClient();
  const parentId = String(fd.get("parent_task_id") ?? "");
  const row: Record<string, unknown> = { ...r.data };
  if (z.uuid().safeParse(parentId).success) row.parent_task_id = parentId;

  const { data, error } = await supabase.from("tasks").insert(row).select("id").single();
  if (error || !data) return { error: "No se pudo crear la tarea", values: formValues(fd) };
  redirect(safeBack(fd, `/tasks/${data.id}`));
}

export async function updateTask(
  id: string,
  _prev: TaskFormState,
  fd: FormData,
): Promise<TaskFormState> {
  if (!z.uuid().safeParse(id).success) return { error: "Tarea no válida" };
  const r = parse(fd);
  if (!r.ok) return r.state;

  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update(r.data).eq("id", id).select("id");
  if (error || !data?.length) {
    return { error: "No se pudo guardar. Puede que no tengas permiso.", values: formValues(fd) };
  }
  redirect(`/tasks/${id}`);
}

export async function setTaskStatus(id: string, fd: FormData) {
  const status = z.enum(["todo", "in_progress", "done", "cancelled"]).safeParse(fd.get("status"));
  if (z.uuid().safeParse(id).success && status.success) {
    const supabase = await createClient();
    await supabase.from("tasks").update({ status: status.data }).eq("id", id);
  }
  redirect(safeBack(fd, `/tasks/${id}`));
}

export async function deleteTask(id: string, fd: FormData) {
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("tasks").delete().eq("id", id);
  }
  redirect(safeBack(fd, "/tasks"));
}

export async function addSubtask(parentId: string, fd: FormData) {
  const title = z.string().trim().min(1).max(300).safeParse(fd.get("title"));
  if (z.uuid().safeParse(parentId).success && title.success) {
    const supabase = await createClient();
    const { data: parent } = await supabase
      .from("tasks")
      .select("case_id, contact_id, assignee_id")
      .eq("id", parentId)
      .maybeSingle();
    if (parent) {
      await supabase.from("tasks").insert({
        title: title.data,
        parent_task_id: parentId,
        case_id: parent.case_id,
        contact_id: parent.contact_id,
        assignee_id: parent.assignee_id,
      });
    }
  }
  redirect(`/tasks/${parentId}`);
}

export async function addChecklistItem(taskId: string, fd: FormData) {
  const label = z.string().trim().min(1).max(200).safeParse(fd.get("label"));
  if (z.uuid().safeParse(taskId).success && label.success) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("task_checklists")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId);
    await supabase
      .from("task_checklists")
      .insert({ task_id: taskId, label: label.data, position: count ?? 0 });
  }
  redirect(`/tasks/${taskId}`);
}

export async function toggleChecklistItem(taskId: string, itemId: string, done: boolean) {
  if (z.uuid().safeParse(itemId).success) {
    const supabase = await createClient();
    await supabase.from("task_checklists").update({ done }).eq("id", itemId);
  }
  redirect(`/tasks/${taskId}`);
}

export async function deleteChecklistItem(taskId: string, itemId: string) {
  if (z.uuid().safeParse(itemId).success) {
    const supabase = await createClient();
    await supabase.from("task_checklists").delete().eq("id", itemId);
  }
  redirect(`/tasks/${taskId}`);
}

// ------------------------------------------------- board moves & dependencies

export async function moveTaskAction(id: string, status: string): Promise<{ ok: boolean }> {
  const parsed = z.enum(["todo", "in_progress", "done"]).safeParse(status);
  if (!z.uuid().safeParse(id).success || !parsed.success) return { ok: false };
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update({ status: parsed.data }).eq("id", id).select("id");
  revalidatePath("/tasks");
  return { ok: !error && !!data?.length };
}

export async function addDependency(taskId: string, fd: FormData) {
  const dep = z.uuid().safeParse(fd.get("depends_on"));
  const back = `/tasks/${taskId}`;
  if (!z.uuid().safeParse(taskId).success || !dep.success) redirect(`${back}?dep_error=1`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: taskId, depends_on_task_id: dep.data });
  redirect(error ? `${back}?dep_error=${/circular/.test(error.message) ? "circular" : "1"}` : back);
}

export async function removeDependency(taskId: string, depId: string) {
  if (z.uuid().safeParse(depId).success) {
    const supabase = await createClient();
    await supabase.from("task_dependencies").delete().eq("id", depId);
  }
  redirect(`/tasks/${taskId}`);
}
