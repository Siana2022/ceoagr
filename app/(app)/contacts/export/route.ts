import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { csvCell } from "@/lib/modules/time/calc";
import { fmtDate } from "@/lib/modules/format";
import { CONTACT_KIND_LABELS, type Contact } from "@/lib/modules/contacts/types";

const sanitize = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();

// Exports what the signed-in user can see (RLS), honoring the list filters.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  let query = supabase
    .from("contacts")
    .select("*")
    .eq("archived", url.searchParams.get("archived") === "1")
    .order("name")
    .limit(20000);
  const kind = url.searchParams.get("kind");
  if (kind === "person" || kind === "company") query = query.eq("kind", kind);
  const tag = url.searchParams.get("tag");
  if (tag) query = query.contains("tags", [tag]);
  const q = sanitize(url.searchParams.get("q") ?? "");
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,tax_id.ilike.%${q}%,phone.ilike.%${q}%,mobile.ilike.%${q}%`);

  const { data } = await query;
  const contacts = (data ?? []) as Contact[];

  const ownerIds = [...new Set(contacts.map((c) => c.owner_id).filter(Boolean))] as string[];
  const owners = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds);
    for (const p of profiles ?? []) owners.set(p.user_id, p.full_name);
  }

  const header = ["Tipo", "Nombre", "Razón social", "NIF/CIF", "Email", "Teléfono", "Móvil", "Calle", "CP", "Ciudad", "Provincia", "País", "Etiquetas", "Origen", "Responsable", "Alta"];
  const rows = contacts.map((c) => [
    CONTACT_KIND_LABELS[c.kind], c.name, c.legal_name ?? "", c.tax_id ?? "", c.email ?? "", c.phone ?? "", c.mobile ?? "",
    c.address.street ?? "", c.address.postal_code ?? "", c.address.city ?? "", c.address.province ?? "", c.address.country ?? "",
    c.tags.join("|"), c.source ?? "", (c.owner_id && owners.get(c.owner_id)) || "", fmtDate(c.created_at),
  ]);

  const body = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contactos.csv"',
    },
  });
}
