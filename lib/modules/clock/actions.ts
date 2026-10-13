"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { safeBack } from "@/lib/modules/redirect";
import { isDateString, madridToUtc } from "@/lib/modules/format";

const kindSchema = z.enum(["in", "out", "pause_start", "pause_end"]);

// The server stamps the time; the client never sends it.
export async function clockAction(kind: string, fd: FormData) {
  const back = safeBack(fd, "/clock");
  const parsed = kindSchema.safeParse(kind);
  const sep = back.includes("?") ? "&" : "?";
  if (!parsed.success) redirect(`${back}${sep}error=1`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("clock_events")
    .insert({ kind: parsed.data, source: "web" });
  redirect(error ? `${back}${sep}error=sequence` : back);
}

const manualSchema = z.object({
  kind: kindSchema,
  date: z.string().refine(isDateString, "Fecha no válida"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
  note: z.string().trim().min(3, "Indica el motivo de la corrección").max(500),
});

// Corrections never edit history: they add a manual event with a mandatory reason.
export async function addManualEvent(userId: string, fd: FormData) {
  const role = await getCurrentRole();
  const base = `/clock/team/${userId}`;
  if (!role || !isAdminRole(role) || !z.uuid().safeParse(userId).success) redirect("/clock");

  const parsed = manualSchema.safeParse({
    kind: fd.get("kind"),
    date: fd.get("date"),
    time: fd.get("time"),
    note: fd.get("note"),
  });
  if (!parsed.success) redirect(`${base}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const supabase = await createClient();
  const { error } = await supabase.from("clock_events").insert({
    user_id: userId,
    kind: parsed.data.kind,
    at: madridToUtc(parsed.data.date, parsed.data.time).toISOString(),
    source: "manual",
    note: parsed.data.note,
  });
  redirect(error ? `${base}?error=${encodeURIComponent("No se pudo guardar la corrección (¿fecha futura?)")}` : `${base}?saved=1`);
}
