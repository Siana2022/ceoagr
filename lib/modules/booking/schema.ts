import { z } from "zod";
import { isDateString } from "@/lib/modules/format";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const bookingRequestSchema = z.object({
  date: z.string().refine(isDateString, "Fecha no válida"),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
  name: z.string().trim().min(1, "Indica tu nombre").max(200),
  email: z.email("Indica un email válido").max(200),
  phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullish()).transform((v) => v ?? null),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullish()).transform((v) => v ?? null),
  // Honeypot: a real visitor never fills this (hidden off-screen, not display:none so simple
  // bots that skip hidden fields still can't tell). Any non-empty value marks the request as a bot.
  website: z.preprocess(emptyToNull, z.string().nullish()).transform((v) => v ?? null),
});

export type BookingRequest = z.output<typeof bookingRequestSchema>;

// Vercel/most proxies set x-forwarded-for as "client, proxy1, proxy2…"; the
// first entry is the original client. Falls back to x-real-ip, then "unknown"
// (grouping all unknown-origin requests into one shared rate-limit bucket,
// which only matters in local dev without a proxy in front).
export function clientIpFrom(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}
