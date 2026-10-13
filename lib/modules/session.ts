import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/modules/nav";

export const getCurrentRole = cache(async (): Promise<AppRole | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_user_role");
  return (data ?? null) as AppRole | null;
});
