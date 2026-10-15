"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";

const text = (max: number) => z.string().trim().max(max);

const brandingSchema = z.object({
  legal_name: text(200),
  tax_id: text(40),
  address: text(300),
  phone: text(40),
  email: z.union([z.literal(""), z.email().max(120)]),
  web: text(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
  footer_text: text(300),
});

export async function saveBranding(fd: FormData) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");

  const g = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
  const parsed = brandingSchema.safeParse({
    legal_name: g("legal_name"), tax_id: g("tax_id"), address: g("address"), phone: g("phone"),
    email: g("email"), web: g("web"), color: g("color") || "#003366", footer_text: g("footer_text"),
  });
  if (!parsed.success) redirect(`/settings/branding?error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const payload: Record<string, unknown> = { ...parsed.data };
  const logo = g("logo_data");
  if (g("remove_logo") === "1") payload.logo_data = null;
  else if (logo) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 700_000) {
      redirect("/settings/branding?error=" + encodeURIComponent("El logotipo debe ser un PNG o JPG de menos de 500 KB"));
    }
    payload.logo_data = logo;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_org_branding", { p_branding: payload });
  redirect(error ? "/settings/branding?error=" + encodeURIComponent("No se pudo guardar") : "/settings/branding?saved=1");
}
