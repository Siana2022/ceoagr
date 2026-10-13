"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.email("Email no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const signupSchema = credentials.extend({
  full_name: z.string().trim().min(1, "Indica tu nombre"),
});

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("/login", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) fail("/login", "Email o contraseña incorrectos");

  redirect("/");
}

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("/signup", parsed.error.issues[0].message);

  const { email, password, full_name } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });
  if (error) fail("/signup", error.message);

  if (!data.session) {
    redirect("/login?message=" + encodeURIComponent("Revisa tu correo para confirmar la cuenta"));
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
