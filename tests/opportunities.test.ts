import { describe, expect, it } from "vitest";
import { effectiveProbability, pipelineStats, quoteTotals } from "@/lib/modules/opportunities/calc";
import { lostSchema, opportunityFormToInput, opportunitySchema, quoteLineSchema, quoteMetaSchema } from "@/lib/modules/opportunities/schema";

describe("pipelineStats", () => {
  const items = [
    { stage: "lead", expected_value: 1000, probability: null },
    { stage: "negotiation", expected_value: 2000, probability: null },
    { stage: "quote_sent", expected_value: 4000, probability: 25 },
    { stage: "won", expected_value: 5000, probability: null },
    { stage: "won", expected_value: 100, probability: null },
    { stage: "lost", expected_value: 700, probability: null },
  ] as const;
  const s = pipelineStats([...items]);
  it("splits open, won and lost", () => {
    expect(s.openCount).toBe(3);
    expect(s.openValue).toBe(7000);
    expect(s.wonCount).toBe(2);
    expect(s.lostCount).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3);
  });
  it("weights open value by stage or explicit probability", () => {
    // 1000*10% + 2000*70% + 4000*25% = 100 + 1400 + 1000
    expect(s.weightedValue).toBe(2500);
    expect(s.byStage.won).toEqual({ count: 2, value: 5100 });
  });
  it("falls back to the stage probability", () => {
    expect(effectiveProbability({ stage: "study", probability: null })).toBe(30);
    expect(effectiveProbability({ stage: "study", probability: 0 })).toBe(0);
  });
  it("has no win rate without closed deals", () => {
    expect(pipelineStats([{ stage: "lead", expected_value: 1, probability: null }]).winRate).toBeNull();
  });
});

describe("quoteTotals", () => {
  it("matches the database arithmetic", () => {
    const t = quoteTotals([{ quantity: 1, unit_price: 1500, hours: 20 }, { quantity: 2, unit_price: 1000, hours: 60 }], 21);
    expect(t).toEqual({ subtotal: 3500, tax: 735, total: 4235, hours: 80 });
  });
  it("handles cents", () => {
    expect(quoteTotals([{ quantity: 3, unit_price: 33.33, hours: null }], 21).subtotal).toBe(99.99);
  });
});

describe("schemas", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const base = { contact_id: "00000000-0000-4000-8000-000000000001", title: "Nave", stage: "lead" };
  it("accepts a minimal opportunity", () => {
    const r = opportunitySchema.safeParse(opportunityFormToInput(fd(base)));
    expect(r.success && [r.data.expected_value, r.data.expected_close]).toEqual([null, null]);
  });
  it("requires a reason to mark as lost", () => {
    expect(opportunitySchema.safeParse(opportunityFormToInput(fd({ ...base, stage: "lost" }))).success).toBe(false);
    expect(opportunitySchema.safeParse(opportunityFormToInput(fd({ ...base, stage: "lost", lost_reason: "Precio" }))).success).toBe(true);
  });
  it("parses comma decimals and rejects bad ranges", () => {
    const ok = opportunitySchema.safeParse(opportunityFormToInput(fd({ ...base, expected_value: "1500,50", probability: "40" })));
    expect(ok.success && ok.data.expected_value).toBe(1500.5);
    expect(opportunitySchema.safeParse(opportunityFormToInput(fd({ ...base, probability: "150" }))).success).toBe(false);
    expect(opportunitySchema.safeParse(opportunityFormToInput(fd({ ...base, expected_value: "-5" }))).success).toBe(false);
  });
  it("validates quote lines and meta", () => {
    expect(quoteLineSchema.safeParse({ description: "Estudio", hours: "20", quantity: "", unit_price: "1500,5" }).success).toBe(true);
    expect(quoteLineSchema.safeParse({ description: "", quantity: "1", unit_price: "1" }).success).toBe(false);
    expect(quoteMetaSchema.safeParse({ title: "P", tax_rate: "21", valid_until: "" }).success).toBe(true);
    expect(quoteMetaSchema.safeParse({ title: "P", tax_rate: "150" }).success).toBe(false);
    expect(lostSchema.safeParse({ lost_reason: "ok" }).success).toBe(false);
  });
});
