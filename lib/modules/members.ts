import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/modules/nav";

export type Member = { user_id: string; full_name: string; role: AppRole };

export async function listMembers(): Promise<Member[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("active", true);
  const ids = (memberships ?? []).map((m) => m.user_id);
  if (!ids.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  return (memberships ?? [])
    .map((m) => ({
      user_id: m.user_id,
      full_name: names.get(m.user_id) || "Sin nombre",
      role: m.role as AppRole,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
}
