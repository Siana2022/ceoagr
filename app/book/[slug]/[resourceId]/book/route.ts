import { NextResponse } from "next/server";
import { bookingRequestSchema, clientIpFrom } from "@/lib/modules/booking/schema";
import { submitPublicBooking } from "@/lib/modules/booking/public";

// Public write endpoint. The client IP is read here, server-side, from the
// request headers — never trusted from the request body — so the per-IP
// rate limit inside public_book_appointment() can't be bypassed by a caller
// simply claiming a different IP.
export async function POST(req: Request, ctx: RouteContext<"/book/[slug]/[resourceId]/book">) {
  const { slug, resourceId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Datos no válidos." }, { status: 400 });
  }

  const ip = clientIpFrom(req.headers);
  const result = await submitPublicBooking(
    {
      slug,
      resourceId,
      date: parsed.data.date,
      startTime: parsed.data.start_time,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      honeypot: parsed.data.website,
    },
    ip,
  );
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
