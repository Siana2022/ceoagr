import { createClient } from "@/lib/supabase/server";
import type { Appointment, AppointmentListItem, Resource } from "./types";

export async function listResources(includeInactive = false): Promise<Resource[]> {
  const supabase = await createClient();
  let q = supabase.from("resources").select("id, name, kind, color, active").order("name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Resource[];
}

export async function listAppointments(fromIso: string, toIso: string, resourceId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("appointments")
    .select("*, contacts(name), resources(name, color)")
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at")
    .limit(1000);
  if (resourceId) q = q.eq("resource_id", resourceId);
  const { data, error } = await q;
  return { rows: (data ?? []) as unknown as AppointmentListItem[], error: error?.message ?? null };
}

export async function getAppointment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
  return (data as Appointment | null) ?? null;
}

export async function listContactAppointments(contactId: string, limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, resources(name, color)")
    .eq("contact_id", contactId)
    .order("starts_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as AppointmentListItem[];
}
