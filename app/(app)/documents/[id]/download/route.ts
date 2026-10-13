import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Short-lived signed URL, issued only if the row is visible to the user (RLS).
export async function GET(_req: Request, ctx: RouteContext<"/documents/[id]/download">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("name, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60, { download: doc.name });
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
