import Link from "next/link";
import { describeAmount } from "@/lib/modules/expenses/calc";
import { KIND_LABELS, STATUS_LABELS, STATUS_STYLE, type ExpenseListItem } from "@/lib/modules/expenses/types";
import { decideExpense, deleteExpense, resubmitExpense } from "@/lib/modules/expenses/actions";
import { fmtDate } from "@/lib/modules/format";
import { formatMoney } from "@/lib/modules/time/calc";

type Props = {
  rows: ExpenseListItem[];
  names: Map<string, string>;
  back: string;
  currentUserId: string | null;
  showPerson?: boolean;
  canDecide?: boolean; // approve / reject
  canReimburse?: boolean;
  empty?: string;
};

export function ExpenseTable({ rows, names, back, currentUserId, showPerson, canDecide, canReimburse, empty }: Props) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            {showPerson && <th>Persona</th>}
            <th>Concepto</th>
            <th>Proyecto</th>
            <th className="text-right">Importe</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const mine = e.user_id === currentUserId;
            return (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{fmtDate(`${e.expense_date}T12:00:00Z`)}</td>
                {showPerson && <td>{names.get(e.user_id) ?? "—"}</td>}
                <td>
                  <span className="font-medium">{KIND_LABELS[e.kind]}</span>
                  {e.billable && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">Repercutible</span>}
                  <span className="block text-xs text-muted">
                    {describeAmount(e.kind, e.quantity, e.unit_amount)}
                    {e.description ? ` · ${e.description}` : ""}
                    {e.receipt_path && (<> · <a href={`/expenses/${e.id}/receipt`} target="_blank" className="link" rel="noreferrer">ticket</a></>)}
                  </span>
                  {e.status === "rejected" && e.decision_note && <span className="block text-xs text-danger">Motivo: {e.decision_note}</span>}
                </td>
                <td>{e.case_id && e.cases ? <Link href={`/cases/${e.case_id}`} className="link">{e.cases.code}</Link> : <span className="text-muted">General</span>}</td>
                <td className="text-right tabular-nums font-medium">{formatMoney(e.amount)}</td>
                <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[e.status]}`}>{STATUS_LABELS[e.status]}</span></td>
                <td className="min-w-52">
                  <div className="flex flex-col items-end gap-1.5 text-sm">
                    {canDecide && e.status === "submitted" && !(mine) && (
                      <form action={decideExpense.bind(null, e.id)} className="flex flex-wrap items-center justify-end gap-1.5">
                        <input type="hidden" name="back" value={back} />
                        <input name="note" placeholder="Motivo (si rechazas)" className="input h-8 w-36 text-xs" maxLength={500} />
                        <button type="submit" name="decision" value="approved" className="btn btn-primary btn-sm">Aprobar</button>
                        <button type="submit" name="decision" value="rejected" className="btn btn-secondary btn-sm">Rechazar</button>
                      </form>
                    )}
                    {canReimburse && e.status === "approved" && (
                      <form action={decideExpense.bind(null, e.id)}>
                        <input type="hidden" name="back" value={back} />
                        <button type="submit" name="decision" value="reimbursed" className="btn btn-secondary btn-sm">Marcar reembolsado</button>
                      </form>
                    )}
                    {mine && e.status === "rejected" && (
                      <form action={resubmitExpense.bind(null, e.id)}>
                        <input type="hidden" name="back" value={back} />
                        <button type="submit" className="link">Reenviar</button>
                      </form>
                    )}
                    {mine && (e.status === "submitted" || e.status === "rejected") && (
                      <form action={deleteExpense.bind(null, e.id)}>
                        <input type="hidden" name="back" value={back} />
                        <button type="submit" className="link-danger">Eliminar</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted">{empty ?? "No hay gastos."}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
