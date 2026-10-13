"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Indica el nombre de la organización"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "El identificador usa 3-40 letras minúsculas, números o guiones"),
});

export async function createOrganization(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/onboarding?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error) {
    const msg = error.code === "23505" ? "Ese identificador ya está en uso" : "No se pudo crear la organización";
    redirect(`/onboarding?error=${encodeURIComponent(msg)}`);
  }

  redirect("/");
}
