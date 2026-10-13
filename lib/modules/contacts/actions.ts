"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import {
  buildContactSchema,
  CONFIGURABLE_FIELDS,
  formToInput,
  formValues,
  type ContactInput,
} from "./schema";
import { getRequiredFields } from "./queries";
import type { ContactFormState } from "./types";

async function parse(fd: FormData): Promise<
  | { ok: true; data: ContactInput }
  | { ok: false; state: NonNullable<ContactFormState> }
> {
  const required = await getRequiredFields();
  const parsed = buildContactSchema(required).safeParse(formToInput(fd));
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join("_");
    fieldErrors[key] ??= issue.message;
  }
  return {
    ok: false,
    state: { error: "Revisa los campos marcados", fieldErrors, values: formValues(fd) },
  };
}

function toRow(data: ContactInput) {
  const { address, ...rest } = data;
  return {
    ...rest,
    address: Object.fromEntries(Object.entries(address).filter(([, v]) => v)),
  };
}

export async function createContact(
  _prev: ContactFormState,
  fd: FormData,
): Promise<ContactFormState> {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) return { error: "No tienes permiso para crear contactos" };

  const result = await parse(fd);
  if (!result.ok) return result.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert(toRow(result.data))
    .select("id")
    .single();
  if (error || !data) {
    return { error: "No se pudo crear el contacto", values: formValues(fd) };
  }
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(
  id: string,
  _prev: ContactFormState,
  fd: FormData,
): Promise<ContactFormState> {
  if (!z.uuid().safeParse(id).success) return { error: "Contacto no válido" };

  const result = await parse(fd);
  if (!result.ok) return result.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .update(toRow(result.data))
    .eq("id", id)
    .select("id");
  if (error || !data?.length) {
    return { error: "No se pudo guardar. Puede que no tengas permiso.", values: formValues(fd) };
  }
  redirect(`/contacts/${id}`);
}

async function setArchived(id: string, archived: boolean) {
  if (!z.uuid().safeParse(id).success) redirect("/contacts");
  const supabase = await createClient();
  await supabase
    .from("contacts")
    .update({ archived, archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  redirect(archived ? "/contacts" : `/contacts/${id}`);
}

export async function archiveContact(id: string) {
  await setArchived(id, true);
}

export async function restoreContact(id: string) {
  await setArchived(id, false);
}

export async function saveRequiredFields(fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/");

  const fields = fd
    .getAll("required")
    .filter((f): f is string => typeof f === "string")
    .filter((f) => (CONFIGURABLE_FIELDS as readonly string[]).includes(f));

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_contact_required_fields", { p_fields: fields });
  redirect(error ? "/settings?error=1" : "/settings?saved=1");
}
