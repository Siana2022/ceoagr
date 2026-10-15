import { createClient } from "@/lib/supabase/server";
import type { SavedView } from "./types";

export async function listViews(entity: SavedView["entity"]): Promise<SavedView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_views")
    .select("id, user_id, entity, name, filters, columns, is_shared")
    .eq("entity", entity)
    .order("name");
  return (data ?? []) as SavedView[];
}
