import { createClient } from "@/lib/supabase/server";
import type { ChecklistItem, Task } from "./types";

export const TASKS_PAGE_SIZE = 25;
const MAX_PAGE = 400;
const sanitize = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();

export type TaskFilters = {
  scope?: "mine" | "team";
  state?: "open" | "done" | "all";
  q?: string;
  caseId?: string;
  contactId?: string;
  page?: number;
  limit?: number; // embedded lists (case / contact sheet)
};

export type TaskListItem = Pick<
  Task,
  "id" | "title" | "status" | "priority" | "assignee_id" | "due_at" | "case_id" | "contact_id"
> & {
  cases: { code: string } | null;
  contacts: { name: string } | null;
};

export async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listTasks(f: TaskFilters) {
  const supabase = await createClient();
  const page = Math.min(Math.max(f.page ?? 1, 1), MAX_PAGE);
  const size = f.limit ?? TASKS_PAGE_SIZE;
  const from = (page - 1) * size;

  let query = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, assignee_id, due_at, case_id, contact_id, cases(code), contacts(name)",
      { count: "exact" },
    )
    .is("parent_task_id", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);

  if (f.scope === "mine") {
    const uid = await getUserId();
    query = query.eq("assignee_id", uid ?? "00000000-0000-0000-0000-000000000000");
  }
  if (f.state === "open") query = query.in("status", ["todo", "in_progress"]);
  if (f.state === "done") query = query.in("status", ["done", "cancelled"]);
  if (f.caseId) query = query.eq("case_id", f.caseId);
  if (f.contactId) query = query.eq("contact_id", f.contactId);
  if (f.q) {
    const q = sanitize(f.q);
    if (q) query = query.ilike("title", `%${q}%`);
  }

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as TaskListItem[];

  const ids = [...new Set(rows.map((r) => r.assignee_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    for (const p of profiles ?? []) names.set(p.user_id, p.full_name);
  }
  return { rows, total: count ?? 0, page, names, error: error?.message ?? null };
}

export async function getTask(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*, cases(id, code, title), contacts(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const { cases, contacts, ...task } = data as Task & {
    cases: { id: string; code: string; title: string } | null;
    contacts: { id: string; name: string } | null;
  };

  const [{ data: subtasks }, { data: checklist }, parent] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_at, assignee_id")
      .eq("parent_task_id", id)
      .order("created_at"),
    supabase.from("task_checklists").select("*").eq("task_id", id).order("position").order("created_at"),
    task.parent_task_id
      ? supabase.from("tasks").select("id, title").eq("id", task.parent_task_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const userIds = new Set<string>();
  if (task.assignee_id) userIds.add(task.assignee_id);
  for (const s of subtasks ?? []) if (s.assignee_id) userIds.add(s.assignee_id);
  const names = new Map<string, string>();
  if (userIds.size) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", [...userIds]);
    for (const p of profiles ?? []) names.set(p.user_id, p.full_name);
  }

  return {
    task: task as Task,
    kase: cases,
    contact: contacts,
    parent: (parent.data as { id: string; title: string } | null) ?? null,
    subtasks: (subtasks ?? []) as Pick<Task, "id" | "title" | "status" | "due_at" | "assignee_id">[],
    checklist: (checklist ?? []) as ChecklistItem[],
    names,
  };
}

export async function listCaseOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("id, code, title")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as { id: string; code: string; title: string }[];
}

// ------------------------------------------------------------ dependencies

export async function getBlockedTaskIds(taskIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!taskIds.length) return out;
  const supabase = await createClient();
  const { data: deps } = await supabase
    .from("task_dependencies")
    .select("task_id, depends_on_task_id")
    .in("task_id", taskIds);
  if (!deps?.length) return out;
  const { data: prereq } = await supabase
    .from("tasks")
    .select("id, status")
    .in("id", [...new Set(deps.map((d) => d.depends_on_task_id))]);
  const status = new Map((prereq ?? []).map((t) => [t.id, t.status]));
  for (const d of deps) {
    const st = status.get(d.depends_on_task_id);
    if (st && st !== "done" && st !== "cancelled") out.add(d.task_id);
  }
  return out;
}

export async function getTaskDependencies(taskId: string, caseId: string | null) {
  const supabase = await createClient();
  const [{ data: up }, { data: down }] = await Promise.all([
    supabase.from("task_dependencies").select("id, depends_on_task_id").eq("task_id", taskId),
    supabase.from("task_dependencies").select("id, task_id").eq("depends_on_task_id", taskId),
  ]);
  const ids = [...new Set([...(up ?? []).map((d) => d.depends_on_task_id), ...(down ?? []).map((d) => d.task_id)])];
  const info = new Map<string, { title: string; status: string }>();
  if (ids.length) {
    const { data } = await supabase.from("tasks").select("id, title, status").in("id", ids);
    for (const t of data ?? []) info.set(t.id, { title: t.title, status: t.status });
  }

  let candidates: { id: string; title: string }[] = [];
  if (caseId) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("case_id", caseId)
      .neq("id", taskId)
      .neq("status", "cancelled")
      .order("created_at")
      .limit(100);
    const linked = new Set(ids);
    candidates = (data ?? []).filter((t) => !linked.has(t.id));
  }
  return {
    dependsOn: (up ?? []).map((d) => ({ depId: d.id, taskId: d.depends_on_task_id, ...(info.get(d.depends_on_task_id) ?? { title: "Tarea no visible", status: "todo" }) })),
    blocks: (down ?? []).map((d) => ({ depId: d.id, taskId: d.task_id, ...(info.get(d.task_id) ?? { title: "Tarea no visible", status: "todo" }) })),
    candidates,
  };
}

export async function getCaseGanttData(caseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, start_at, due_at, assignee_id, priority")
    .eq("case_id", caseId)
    .order("created_at")
    .limit(500);
  const rows = (data ?? []) as { id: string; title: string; status: "todo" | "in_progress" | "done" | "cancelled"; start_at: string | null; due_at: string | null; assignee_id: string | null; priority: string }[];

  const names = new Map<string, string>();
  const userIds = [...new Set(rows.map((r) => r.assignee_id).filter(Boolean))] as string[];
  if (userIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    for (const p of profiles ?? []) names.set(p.user_id, p.full_name);
  }
  const { data: deps } = rows.length
    ? await supabase.from("task_dependencies").select("task_id, depends_on_task_id").in("task_id", rows.map((r) => r.id))
    : { data: [] };

  return {
    tasks: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      start: r.start_at ? r.start_at.slice(0, 10) : null,
      due: r.due_at ? r.due_at.slice(0, 10) : null,
      assignee: (r.assignee_id && names.get(r.assignee_id)) || null,
      priority: r.priority,
    })),
    deps: (deps ?? []) as { task_id: string; depends_on_task_id: string }[],
  };
}
