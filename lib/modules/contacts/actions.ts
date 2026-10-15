"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isAdminRole, isStaffRole } from "@/lib/modules/nav";
import {
  buildContactSchema,
  CONFIGURABLE_FIELDS,
  formToInput,
  formValues,
  type ContactInput,
} from "./schema";
import { findSimilarContacts, getRequiredFields } from "./queries";
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

  if (fd.get("force") !== "1") {
    const similar = await findSimilarContacts(result.data);
    if (similar.length) {
      return {
        error: "Ya existe un contacto con el mismo email, NIF o teléfono. Revísalo antes de crear un duplicado.",
        duplicates: similar,
        values: formValues(fd),
      };
    }
  }

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

export async function mergeContactsAction(fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/contacts");

  const primary = String(fd.get("primary") ?? "");
  const dups = fd.getAll("merge").map(String).filter((id) => id !== primary);
  const ids = z.array(z.uuid()).safeParse([primary, ...dups]);
  if (!ids.success || dups.length === 0) redirect("/contacts/duplicates?error=1");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("merge_contacts", { p_primary: primary, p_duplicates: dups });
  redirect(error ? "/contacts/duplicates?error=1" : `/contacts/duplicates?merged=${data ?? dups.length}`);
}

// ---------------------------------------------------------- relations & sharing

export async function addRelation(contactId: string, fd: FormData) {
  const back = `/contacts/${contactId}?tab=relations`;
  const role = await getCurrentRole();
  if (!role || !canWrite(role) || !z.uuid().safeParse(contactId).success) redirect("/contacts");

  const custom = String(fd.get("custom_type") ?? "").trim();
  const parsed = z
    .object({
      related: z.uuid(),
      type: z.string().trim().min(1).max(60),
    })
    .safeParse({ related: fd.get("related"), type: custom || fd.get("type") });
  if (!parsed.success || parsed.data.related === contactId) redirect(`${back}&error=1`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_relations")
    .insert({ contact_id: contactId, related_contact_id: parsed.data.related, relation_type: parsed.data.type });
  redirect(error ? `${back}&error=1` : back);
}

export async function deleteRelation(contactId: string, relationId: string) {
  if (z.uuid().safeParse(relationId).success) {
    const supabase = await createClient();
    await supabase.from("contact_relations").delete().eq("id", relationId);
  }
  redirect(`/contacts/${contactId}?tab=relations`);
}

export async function shareContact(contactId: string, fd: FormData) {
  const parsed = z
    .object({ user_id: z.uuid(), permission: z.enum(["view", "edit"]) })
    .safeParse({ user_id: fd.get("user_id"), permission: fd.get("permission") });
  if (z.uuid().safeParse(contactId).success && parsed.success) {
    const supabase = await createClient();
    await supabase
      .from("record_shares")
      .upsert({ entity: "contact", entity_id: contactId, ...parsed.data }, { onConflict: "entity,entity_id,user_id" });
  }
  redirect(`/contacts/${contactId}`);
}

export async function unshareContact(contactId: string, shareId: string) {
  if (z.uuid().safeParse(shareId).success) {
    const supabase = await createClient();
    await supabase.from("record_shares").delete().eq("id", shareId);
  }
  redirect(`/contacts/${contactId}`);
}
