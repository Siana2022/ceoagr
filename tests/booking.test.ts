import { describe, expect, it } from "vitest";
import { bookingRequestSchema, clientIpFrom } from "@/lib/modules/booking/schema";

describe("clientIpFrom", () => {
  it("takes the first address in x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" });
    expect(clientIpFrom(h)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});

describe("bookingRequestSchema", () => {
  const base = { date: "2026-11-02", start_time: "10:00", name: "Ana", email: "ana@example.test", phone: "", notes: "", website: "" };
  it("accepts a minimal valid request and normalizes empty optionals to null", () => {
    const r = bookingRequestSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBeNull();
      expect(r.data.notes).toBeNull();
      expect(r.data.website).toBeNull();
    }
  });
  it("rejects a missing name or a bad email", () => {
    expect(bookingRequestSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });
  it("rejects a malformed date or time", () => {
    expect(bookingRequestSchema.safeParse({ ...base, date: "02/11/2026" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, start_time: "25:00" }).success).toBe(false);
  });
  it("keeps a filled honeypot value instead of discarding it", () => {
    const r = bookingRequestSchema.safeParse({ ...base, website: "https://spam.example" });
    expect(r.success && r.data.website).toBe("https://spam.example");
  });
});
