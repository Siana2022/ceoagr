"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { generatePassword } from "./password";
import { ASSIGNABLE_ROLES, memberSchema, newPasswordSchema } from "./schema";
import type { AccountFormState, MemberFormState, PasswordResetState } from "./types";

const NOT_CONFIGURED =
  "Falta configurar la clave de servicio de Supabase (SUPABASE_SERVICE_ROLE_KEY) en el servidor.";

async function requireAdmin() {
  const role = await getCurrentRole();
  return !!role && isAdminRole(role);
}

// The target must belong to the caller's organization (RLS-filtered read) and
// must not be an owner.
async function loadTarget(userId: string) {
  if (!z.uuid().safeParse(userId).success) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("memberships")
    .select("user_id, role, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.role === "owner" || data.user_id === user?.id) return null;
  return data;
}

export async function createMember(_prev: MemberFormState, fd: FormData): Promise<MemberFormState> {
  if (!(await requireAdmin())) return { error: "No tienes permiso para crear usuarios" };
  if (!hasAdminKey()) return { error: NOT_CONFIGURED };

  const values = Object.fromEntries(
    [...fd.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  const parsed = memberSchema.safeParse({
    full_name: fd.get("full_name") ?? "",
    email: fd.get("email") ?? "",
    role: fd.get("role") ?? "",
    password: fd.get("password") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Revisa los campos marcados", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { error: "No se pudo determinar la organización" };

  const { full_name, email, role } = parsed.data;
  const password = parsed.data.password ?? generatePassword();

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error || !created.user) {
    const exists = /already|registered|exists/i.test(error?.message ?? "");
    return {
      error: exists ? "Ya existe un usuario con ese email" : "No se pudo crear el usuario",
      values,
    };
  }

  const { error: memberError } = await admin
    .from("memberships")
    .insert({ org_id: orgId, user_id: created.user.id, role });
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "No se pudo añadir el usuario a la organización", values };
  }

  return { created: { name: full_name, email, password } };
}

export async function updateMemberRole(userId: string, fd: FormData) {
  const role = z.enum(ASSIGNABLE_ROLES).safeParse(fd.get("role"));
  if ((await requireAdmin()) && role.success && (await loadTarget(userId))) {
    const supabase = await createClient();
    await supabase.from("memberships").update({ role: role.data }).eq("user_id", userId);
  }
  redirect("/settings/team");
}

export async function setMemberActive(userId: string, active: boolean) {
  if ((await requireAdmin()) && hasAdminKey() && (await loadTarget(userId))) {
    const supabase = await createClient();
    const { error } = await supabase.from("memberships").update({ active }).eq("user_id", userId);
    if (!error) {
      // A deactivated user can no longer sign in at all.
      await createAdminClient().auth.admin.updateUserById(userId, {
        ban_duration: active ? "none" : "876000h",
      });
    }
  }
  redirect("/settings/team");
}

export async function resetMemberPassword(userId: string): Promise<PasswordResetState> {
  if (!(await requireAdmin())) return { error: "No tienes permiso" };
  if (!hasAdminKey()) return { error: NOT_CONFIGURED };
  if (!(await loadTarget(userId))) return { error: "Usuario no válido" };

  const password = generatePassword();
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) return { error: "No se pudo restablecer la contraseña" };
  return { password };
}

// ------------------------------------------------------------- own account

export async function changeOwnPassword(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: fd.get("password") ?? "",
    confirm: fd.get("confirm") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "No se pudo cambiar la contraseña. Vuelve a iniciar sesión e inténtalo de nuevo." };
  return { ok: true };
}
