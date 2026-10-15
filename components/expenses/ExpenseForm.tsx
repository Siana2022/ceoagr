"use client";

import { useActionState, useState } from "react";
import { createExpense } from "@/lib/modules/expenses/actions";
import { priceExpense, lineTotal } from "@/lib/modules/expenses/calc";
import { KIND_LABELS, type ExpenseFormState, type ExpenseKind, type ExpenseRates } from "@/lib/modules/expenses/types";

type Props = { cases: { id: string; code: string; title: string }[]; rates: ExpenseRates; today: string };

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export function ExpenseForm({ cases, rates, today }: Props) {
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(createExpense, undefined);
  const v = state?.values ?? {};
  const [kind, setKind] = useState<ExpenseKind>((v.kind as ExpenseKind) || "kilometraje");
  const [km, setKm] = useState(v.km ?? "");
  const [days, setDays] = useState(v.days ?? "1");
  const [overnight, setOvernight] = useState(v.overnight === "on");
  const [amount, setAmount] = useState(v.amount ?? "");

  const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const priced = priceExpense({ kind, km: n(km), days: n(days), overnight, amount: n(amount) }, rates);
  const total = priced ? lineTotal(priced.quantity, priced.unit_amount) : null;

  return (
    <form key={state?.ok ? "ok" : "form"} action={formAction} className="flex flex-col gap-4">
      {state?.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state?.ok && <p role="status" className="alert-ok">Gasto registrado. Queda pendiente de aprobación.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field">
          Tipo *
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as ExpenseKind)} className="input">
            {Object.entries(KIND_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </label>
        <label className="field">
          Fecha *
          <input name="expense_date" type="date" required max={today} defaultValue={v.expense_date ?? today} className="input" />
        </label>

        {kind === "kilometraje" && (
          <label className="field">
            Kilómetros * <span className="font-normal text-muted">({eur(rates.km_rate)}/km)</span>
            <input name="km" inputMode="decimal" required value={km} onChange={(e) => setKm(e.target.value)} className="input" placeholder="120" />
          </label>
        )}
        {kind === "dieta" && (
          <>
            <label className="field">
              Días *
              <input name="days" type="number" min={1} max={31} required value={days} onChange={(e) => setDays(e.target.value)} className="input" />
            </label>
            <label className="flex items-end gap-2 pb-2.5 text-sm">
              <input type="checkbox" name="overnight" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
              Con pernocta ({eur(overnight ? rates.dieta_overnight : rates.dieta)}/día)
            </label>
          </>
        )}
        {kind !== "kilometraje" && kind !== "dieta" && (
          <label className="field">
            Importe (€) *
            <input name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="89,90" />
          </label>
        )}

        <label className="field lg:col-span-2">
          Expediente
          <select name="case_id" defaultValue={v.case_id ?? ""} className="input">
            <option value="">Sin expediente (gasto general)</option>
            {cases.map((c) => (<option key={c.id} value={c.id}>{c.code} · {c.title}</option>))}
          </select>
        </label>
        <label className="field lg:col-span-2">
          Ticket o factura <span className="font-normal text-muted">(JPG, PNG o PDF, máx. 10 MB)</span>
          <input name="receipt" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="input h-auto py-2 text-sm" />
        </label>
        <label className="field sm:col-span-2 lg:col-span-3">
          Descripción
          <input name="description" defaultValue={v.description ?? ""} className="input" placeholder="Ej.: Visita a obra en Sagunto" />
        </label>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="billable" defaultChecked={v.billable === "on"} /> Repercutible al cliente
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : "Registrar gasto"}</button>
        <p className="text-sm text-muted">
          {total !== null ? <>Importe: <strong className="text-foreground">{eur(total)}</strong></> : "Rellena los datos para ver el importe."}
        </p>
      </div>
    </form>
  );
}
