import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

// The expense row is read with the user's session (RLS decides who may see it);
// only then is a short-lived signed URL issued.
export async function GET(_req: Request, ctx: RouteContext<"/expenses/[id]/receipt">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: expense } = await supabase.from("expenses").select("receipt_path").eq("id", id).maybeSingle();
  if (!expense?.receipt_path || !hasAdminKey()) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await createAdminClient().storage
    .from("documents")
    .createSignedUrl(expense.receipt_path, 60);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
