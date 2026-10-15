import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { loadOrg } from "@/lib/modules/documents/generate";
import { sampleContext } from "@/lib/modules/documents/context";
import { renderTemplate } from "@/lib/modules/documents/render";
import { renderPdf } from "@/lib/modules/pdf/engine";
import { fmtDate } from "@/lib/modules/format";

// PDF preview of a saved template with sample data (inline, never stored).
export async function GET(_req: Request, ctx: RouteContext<"/settings/templates/[id]/preview">) {
  const role = await getCurrentRole();
  const { id } = await ctx.params;
  if (!role || !isStaffRole(role) || !z.uuid().safeParse(id).success) return new NextResponse("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data: t } = await supabase.from("document_templates").select("name, body, page_settings").eq("id", id).maybeSingle();
  if (!t) return new NextResponse("Not found", { status: 404 });

  try {
    const org = await loadOrg(supabase);
    const { html } = renderTemplate(t.body, sampleContext({ name: org.name, branding: org.branding }, fmtDate(new Date().toISOString())));
    const pdf = await renderPdf(html, t.page_settings, org.pdf, `${t.name} (vista previa)`);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="vista-previa.pdf"`, "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse("No se pudo generar la vista previa", { status: 500 });
  }
}
