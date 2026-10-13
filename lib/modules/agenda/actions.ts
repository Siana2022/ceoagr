"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { safeBack } from "@/lib/modules/redirect";
import { madridParts } from "@/lib/modules/format";
import {
  appointmentFormToInput,
  appointmentSchema,
  resourceSchema,
  toAppointmentRow,
} from "./schema";
import type { AgendaFormState } from "./types";

function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

const OVERLAP = "23P01"; // exclusion_violation

function dbError(code: string | undefined) {
  return code === OVERLAP
    ? "Ese recurso ya está ocupado en ese horario"
    : "No se pudo guardar la cita. Puede que no tengas permiso.";
}

function parse(fd: FormData) {
  const parsed = appointmentSchema.safeParse(appointmentFormToInput(fd));
  if (parsed.success) return { ok: true, data: parsed.data } as const;
  const fieldErrors: Record<string, string> = {};
  for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return {
    ok: false,
    state: { error: "Revisa los campos marcados", fieldErrors, values: formValues(fd) },
  } as const;
}

export async function createAppointment(_prev: AgendaFormState, fd: FormData): Promise<AgendaFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para crear citas" };
  const r = parse(fd);
  if (!r.ok) return r.state;

  const supabase = await createClient();
  const { error } = await supabase.from("appointments").insert(toAppointmentRow(r.data));
  if (error) return { error: dbError(error.code), values: formValues(fd) };
  redirect(safeBack(fd, `/calendar?date=${r.data.date}&view=week`));
}

export async function updateAppointment(
  id: string,
  _prev: AgendaFormState,
  fd: FormData,
): Promise<AgendaFormState> {
  if (!z.uuid().safeParse(id).success) return { error: "Cita no válida" };
  const r = parse(fd);
  if (!r.ok) return r.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update(toAppointmentRow(r.data))
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: dbError(error?.code), values: formValues(fd) };
  redirect(`/calendar?date=${r.data.date}&view=week`);
}

export async function setAppointmentStatus(id: string, fd: FormData) {
  const status = z.enum(["pending", "confirmed", "cancelled", "no_show"]).safeParse(fd.get("status"));
  const back = safeBack(fd, "/calendar");
  if (z.uuid().safeParse(id).success && status.success) {
    const supabase = await createClient();
    await supabase.from("appointments").update({ status: status.data }).eq("id", id);
  }
  redirect(back);
}

export async function deleteAppointment(id: string, fd: FormData) {
  if (z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    const { data } = await supabase.from("appointments").select("starts_at").eq("id", id).maybeSingle();
    await supabase.from("appointments").delete().eq("id", id);
    if (data) redirect(`/calendar?date=${madridParts(data.starts_at).date}&view=week`);
  }
  redirect(safeBack(fd, "/calendar"));
}

// -------------------------------------------------------------- resources

export async function createResource(fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/calendar");
  const parsed = resourceSchema.safeParse({
    name: fd.get("name"),
    kind: fd.get("kind"),
    color: fd.get("color"),
  });
  if (!parsed.success) redirect("/settings/resources?error=1");
  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert(parsed.data);
  redirect(error ? "/settings/resources?error=1" : "/settings/resources?saved=1");
}

export async function updateResource(id: string, fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role) || !z.uuid().safeParse(id).success) redirect("/calendar");
  const parsed = resourceSchema.safeParse({
    name: fd.get("name"),
    kind: fd.get("kind"),
    color: fd.get("color"),
  });
  if (!parsed.success) redirect("/settings/resources?error=1");
  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .update({ ...parsed.data, active: fd.get("active") === "on" })
    .eq("id", id);
  redirect(error ? "/settings/resources?error=1" : "/settings/resources?saved=1");
}
