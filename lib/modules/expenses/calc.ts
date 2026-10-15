import type { ExpenseKind, ExpenseRates } from "./types";

export type ExpenseInput = {
  kind: ExpenseKind;
  km: number | null;
  days: number | null;
  overnight: boolean;
  amount: number | null;
};

// Quantity and unit price stored for an expense. Rates are frozen into the row,
// so later rate changes never alter past expenses.
export function priceExpense(input: ExpenseInput, rates: ExpenseRates): { quantity: number; unit_amount: number } | null {
  switch (input.kind) {
    case "kilometraje":
      return input.km && input.km > 0 ? { quantity: round2(input.km), unit_amount: rates.km_rate } : null;
    case "dieta":
      return input.days && input.days > 0
        ? { quantity: input.days, unit_amount: input.overnight ? rates.dieta_overnight : rates.dieta }
        : null;
    default:
      return input.amount && input.amount > 0 ? { quantity: 1, unit_amount: round2(input.amount) } : null;
  }
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const lineTotal = (quantity: number, unit: number) => round2(quantity * unit);

export function describeAmount(kind: ExpenseKind, quantity: number, unit: number) {
  const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  if (kind === "kilometraje") return `${quantity.toLocaleString("es-ES")} km × ${eur(unit)}`;
  if (kind === "dieta") return `${quantity} día${quantity === 1 ? "" : "s"} × ${eur(unit)}`;
  return eur(unit);
}

export type Totals = { submitted: number; approved: number; reimbursed: number; rejected: number };

export function totalsByStatus(rows: { status: keyof Totals; amount: number }[]): Totals {
  const t: Totals = { submitted: 0, approved: 0, reimbursed: 0, rejected: 0 };
  for (const r of rows) t[r.status] = round2(t[r.status] + Number(r.amount));
  return t;
}

// Profit margin of a project: fees minus personnel cost minus expenses the
// company absorbs (those re-billed to the client do not reduce the margin).
export function projectMargin(fee: number | null, personnelCost: number | null, absorbedExpenses: number) {
  if (fee == null || personnelCost == null) return null;
  return round2(fee - personnelCost - absorbedExpenses);
}
