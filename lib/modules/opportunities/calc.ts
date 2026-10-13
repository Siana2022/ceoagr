import { OPEN_STAGES, STAGES, type Opportunity, type Stage } from "./types";

export const stageInfo = (s: Stage) => STAGES.find((x) => x.key === s) ?? STAGES[0];

export function effectiveProbability(o: Pick<Opportunity, "stage" | "probability">) {
  return o.probability ?? stageInfo(o.stage).probability;
}

export type PipelineStats = {
  openCount: number;
  openValue: number;
  weightedValue: number;
  wonCount: number;
  lostCount: number;
  winRate: number | null; // won / (won + lost)
  byStage: Record<Stage, { count: number; value: number }>;
};

export function pipelineStats(items: Pick<Opportunity, "stage" | "expected_value" | "probability">[]): PipelineStats {
  const byStage = Object.fromEntries(STAGES.map((s) => [s.key, { count: 0, value: 0 }])) as PipelineStats["byStage"];
  let openCount = 0, openValue = 0, weighted = 0, won = 0, lost = 0;

  for (const o of items) {
    const v = Number(o.expected_value ?? 0);
    byStage[o.stage].count += 1;
    byStage[o.stage].value += v;
    if (OPEN_STAGES.includes(o.stage)) {
      openCount += 1;
      openValue += v;
      weighted += (v * effectiveProbability(o)) / 100;
    } else if (o.stage === "won") won += 1;
    else if (o.stage === "lost") lost += 1;
  }
  return {
    openCount,
    openValue,
    weightedValue: Math.round(weighted * 100) / 100,
    wonCount: won,
    lostCount: lost,
    winRate: won + lost > 0 ? won / (won + lost) : null,
    byStage,
  };
}

// Quote totals mirror the database trigger (used for previews and the HTML document).
export function quoteTotals(lines: { quantity: number; unit_price: number; hours: number | null }[], taxRate: number) {
  const amounts = lines.map((l) => Math.round(l.quantity * l.unit_price * 100) / 100);
  const subtotal = Math.round(amounts.reduce((s, a) => s + a, 0) * 100) / 100;
  const tax = Math.round(subtotal * taxRate) / 100;
  return {
    subtotal,
    tax,
    total: Math.round((subtotal + tax) * 100) / 100,
    hours: lines.reduce((s, l) => s + (l.hours ?? 0), 0),
  };
}
