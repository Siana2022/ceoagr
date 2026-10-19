import { NextResponse } from "next/server";
import { isDateString } from "@/lib/modules/format";
import { getPublicSlots } from "@/lib/modules/booking/public";

// Public, read-only: free start times ("HH:MM") for one resource on one day.
export async function GET(req: Request, ctx: RouteContext<"/book/[slug]/[resourceId]/slots">) {
  const { slug, resourceId } = await ctx.params;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!isDateString(date)) return NextResponse.json({ slots: [] });

  const slots = await getPublicSlots(slug, resourceId, date);
  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
