import type { ReactNode } from "react";
import { maxOf, type CountRow } from "@/lib/modules/dashboards/calc";

export function Widget({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "ok" }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone === "danger" ? "text-danger" : tone === "ok" ? "text-success" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// Horizontal bars; each bar is also readable as text (value next to the label).
export function BarList({ rows, format, empty = "Sin datos en este periodo." }: { rows: CountRow[]; format?: (v: number) => string; empty?: string }) {
  const max = maxOf(rows);
  if (!rows.length || max === 0) return <p className="py-4 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3" role="list">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{format ? format(r.value) : r.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? "#003366" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Two-series comparison per row (e.g. clocked vs logged hours).
export function PairBars({
  rows, aLabel, bLabel, aColor = "#003366", bColor = "#f5c2a1", fmt,
}: {
  rows: { key: string; label: string; a: number; b: number }[];
  aLabel: string; bLabel: string; aColor?: string; bColor?: string; fmt: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  if (!rows.length) return <p className="py-4 text-center text-sm text-muted">Sin datos en este periodo.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: aColor }} />{aLabel}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: bColor }} />{bLabel}</span>
      </p>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key}>
            <p className="mb-1 flex justify-between text-sm"><span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{fmt(r.a)} · {fmt(r.b)}{r.a > 0 ? ` (${Math.round((r.b / r.a) * 100)}%)` : ""}</span></p>
            <div className="flex flex-col gap-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(r.a / max) * 100}%`, backgroundColor: aColor }} /></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(r.b / max) * 100}%`, backgroundColor: bColor }} /></div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
