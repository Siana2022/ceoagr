import { describe, expect, it } from "vitest";
import { describeAmount, lineTotal, priceExpense, projectMargin, totalsByStatus } from "@/lib/modules/expenses/calc";
import { expenseFormToInput, expenseSchema, ratesSchema } from "@/lib/modules/expenses/schema";
import { DEFAULT_RATES } from "@/lib/modules/expenses/types";

describe("priceExpense", () => {
  const base = { km: null, days: null, overnight: false, amount: null };
  it("prices mileage with the km rate", () => {
    const p = priceExpense({ ...base, kind: "kilometraje", km: 120 }, DEFAULT_RATES);
    expect(p).toEqual({ quantity: 120, unit_amount: 0.26 });
    expect(lineTotal(p!.quantity, p!.unit_amount)).toBe(31.2);
  });
  it("prices per diem with or without overnight stay", () => {
    expect(priceExpense({ ...base, kind: "dieta", days: 2 }, DEFAULT_RATES)).toEqual({ quantity: 2, unit_amount: 26.67 });
    expect(priceExpense({ ...base, kind: "dieta", days: 2, overnight: true }, DEFAULT_RATES)).toEqual({ quantity: 2, unit_amount: 53.34 });
  });
  it("uses the typed amount for the rest and rejects missing data", () => {
    expect(priceExpense({ ...base, kind: "material", amount: 89.9 }, DEFAULT_RATES)).toEqual({ quantity: 1, unit_amount: 89.9 });
    expect(priceExpense({ ...base, kind: "material" }, DEFAULT_RATES)).toBeNull();
    expect(priceExpense({ ...base, kind: "kilometraje", km: 0 }, DEFAULT_RATES)).toBeNull();
  });
  it("freezes the rate used (custom rates)", () => {
    expect(priceExpense({ ...base, kind: "kilometraje", km: 100 }, { ...DEFAULT_RATES, km_rate: 0.3 })?.unit_amount).toBe(0.3);
  });
  it("describes the calculation", () => {
    expect(describeAmount("kilometraje", 120, 0.26)).toContain("120 km");
    expect(describeAmount("dieta", 1, 26.67)).toContain("1 día ×");
    expect(describeAmount("dieta", 2, 26.67)).toContain("2 días");
  });
});

describe("totals and margin", () => {
  it("sums by status with rounding", () => {
    const t = totalsByStatus([
      { status: "approved", amount: 10.1 }, { status: "approved", amount: 20.2 },
      { status: "submitted", amount: 5 }, { status: "rejected", amount: 7 },
    ]);
    expect(t).toEqual({ submitted: 5, approved: 30.3, reimbursed: 0, rejected: 7 });
  });
  it("subtracts only expenses the company absorbs", () => {
    expect(projectMargin(10000, 4000, 250)).toBe(5750);
    expect(projectMargin(null, 4000, 0)).toBeNull();
    expect(projectMargin(10000, null, 0)).toBeNull();
  });
});

describe("expense schema", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const base = { kind: "material", expense_date: "2026-01-15", amount: "50" };
  it("accepts a normal expense with comma decimals", () => {
    const r = expenseSchema.safeParse(expenseFormToInput(fd({ ...base, amount: "49,90" })));
    expect(r.success && r.data.amount).toBe(49.9);
  });
  it("requires the field that matches the kind", () => {
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, kind: "kilometraje" }))).success).toBe(false);
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, kind: "dieta" }))).success).toBe(false);
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ kind: "material", expense_date: "2026-01-15" }))).success).toBe(false);
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, kind: "kilometraje", km: "80" }))).success).toBe(true);
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, kind: "dieta", days: "2" }))).success).toBe(true);
  });
  it("rejects future dates, negative and absurd values", () => {
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, expense_date: "2999-01-01" }))).success).toBe(false);
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, amount: "-5" }))).success).toBe(false);
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, kind: "kilometraje", km: "99999" }))).success).toBe(false);
    expect(expenseSchema.safeParse(expenseFormToInput(fd({ ...base, kind: "dieta", days: "1,5" }))).success).toBe(false);
  });
  it("validates rates", () => {
    expect(ratesSchema.safeParse({ km_rate: "0,26", dieta: "26,67", dieta_overnight: "53,34" }).success).toBe(true);
    expect(ratesSchema.safeParse({ km_rate: "9", dieta: "1", dieta_overnight: "1" }).success).toBe(false);
  });
});
