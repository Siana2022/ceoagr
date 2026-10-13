import { createClient } from "@/lib/supabase/server";

export type TaskTemplate = {
  id: string;
  case_type_id: string;
  status_key: string;
  title: string;
  description: string | null;
  assign_to: "owner" | "actor" | "none";
  due_offset_days: number | null;
  priority: "low" | "normal" | "high" | "urgent";
  checklist: string[];
  position: number;
  active: boolean;
};

export async function listTaskTemplates(caseTypeId: string): Promise<TaskTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("case_task_templates")
    .select("*")
    .eq("case_type_id", caseTypeId)
    .order("position")
    .order("created_at");
  return (data ?? []) as TaskTemplate[];
}

export async function getTaskTemplate(id: string): Promise<TaskTemplate | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("case_task_templates").select("*").eq("id", id).maybeSingle();
  return (data as TaskTemplate | null) ?? null;
}
