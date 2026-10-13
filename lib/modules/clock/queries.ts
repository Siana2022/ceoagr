import { createClient } from "@/lib/supabase/server";
import { addDays, madridToUtc } from "@/lib/modules/format";
import { monthRange, type ClockEvent } from "./calc";

export async function listClockEvents(opts: { userId?: string; fromIso: string; toIso: string; limit?: number }) {
  const supabase = await createClient();
  let q = supabase
    .from("clock_events")
    .select("id, user_id, kind, at, source, note")
    .gte("at", opts.fromIso)
    .lt("at", opts.toIso)
    .order("at", { ascending: true })
    .limit(opts.limit ?? 5000);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data } = await q;
  return (data ?? []) as ClockEvent[];
}

// Month window plus two days of margin before it, so a shift that started
// the previous evening is still paired with its "out".
export async function listMonthEvents(month: string, userId?: string) {
  const r = monthRange(month);
  return listClockEvents({
    userId,
    fromIso: madridToUtc(addDays(r.first, -2), "00:00").toISOString(),
    toIso: madridToUtc(addDays(r.next, 1), "00:00").toISOString(),
  });
}

export async function listTodayEvents(userId: string, todayStart: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clock_events")
    .select("id, user_id, kind, at, source, note")
    .eq("user_id", userId)
    .gte("at", todayStart)
    .order("at", { ascending: true });
  return (data ?? []) as ClockEvent[];
}

export async function getLastClockEvent(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clock_events")
    .select("id, user_id, kind, at, source, note")
    .eq("user_id", userId)
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ClockEvent | null) ?? null;
}
