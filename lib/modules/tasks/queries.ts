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
