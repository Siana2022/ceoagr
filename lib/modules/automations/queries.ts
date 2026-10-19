import { createClient } from "@/lib/supabase/server";
import type { Automation, AutomationRun } from "./types";

export async function listAutomations(): Promise<Automation[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("automations").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Automation[];
}

export async function getAutomation(id: string): Promise<Automation | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("automations").select("*").eq("id", id).maybeSingle();
  return (data as Automation | null) ?? null;
}

export async function listAutomationRuns(limit = 50): Promise<AutomationRun[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AutomationRun[];
}

export async function getWebhookSecret(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_automation_secret");
  return error ? null : (data as string);
}
