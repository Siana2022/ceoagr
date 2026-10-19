import "server-only";
import { createClient } from "@/lib/supabase/server";

// Everything here talks to the three `anon`-callable RPC functions created in
// 20261019000100_online_booking.sql. The caller's identity is irrelevant to
// those functions (they are SECURITY DEFINER and validate everything
// themselves), so the normal server client works whether or not anyone is
// signed in — exactly what a public booking page needs.

export type PublicResource = { id: string; name: string; kind: string; color: string; slot_minutes: number };
export type PublicOrgInfo = { org_name: string; org_color: string; org_logo: string | null; resources: PublicResource[] };

export async function getPublicBookingInfo(slug: string): Promise<PublicOrgInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_org_booking_info", { p_org_slug: slug });
  if (error || !data) return null;
  return data as PublicOrgInfo;
}

export async function getPublicResource(slug: string, resourceId: string): Promise<PublicResource | null> {
  const info = await getPublicBookingInfo(slug);
  return info?.resources.find((r) => r.id === resourceId) ?? null;
}

export async function getPublicSlots(slug: string, resourceId: string, date: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_list_slots", {
    p_org_slug: slug,
    p_resource_id: resourceId,
    p_date: date,
  });
  return error ? [] : ((data as string[] | null) ?? []);
}

export type PublicBookingInput = {
  slug: string;
  resourceId: string;
  date: string;
  startTime: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  honeypot: string | null;
};

export type PublicBookingResult = { ok: boolean; message: string; resource_name?: string };

// `ip` is deliberately a separate, server-trusted argument: it must come from
// the request headers of our own Route Handler, never from the request body.
export async function submitPublicBooking(input: PublicBookingInput, ip: string): Promise<PublicBookingResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_book_appointment", {
    p_org_slug: input.slug,
    p_resource_id: input.resourceId,
    p_date: input.date,
    p_start_time: input.startTime,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_notes: input.notes,
    p_ip: ip,
    p_honeypot: input.honeypot,
  });
  if (error || !data) return { ok: false, message: "No se pudo completar la reserva. Inténtalo de nuevo." };
  return data as PublicBookingResult;
}
