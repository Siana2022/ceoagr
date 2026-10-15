import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { getUserId } from "@/lib/modules/tasks/queries";
import { listExpenses } from "@/lib/modules/expenses/queries";
import { totalsByStatus } from "@/lib/modules/expenses/calc";
import { STATUS_LABELS, type ExpenseStatus } from "@/lib/modules/expenses/types";
import { isMonth, monthRange } from "@/lib/modules/clock/calc";
import { formatMoney } from "@/lib/modules/time/calc";
import { todayMadrid } from "@/lib/modules/format";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { z } from "zod";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ApprovalsPage({ searchParams }: PageProps<"/expenses/approvals">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/expenses");
  const sp = await searchParams;

  const monthParam = first(sp.month);
  const month = isMonth(monthParam) ? monthParam : todayMadrid().slice(0, 7);
  const r = monthRange(month);
  const statusParam = first(sp.status);
  const status = (["submitted", "approved", "rejected", "reimbursed"] as const).find((s) => s === statusParam);
  const userParam = first(sp.user);
  const userId = z.uuid().safeParse(userParam).success ? userParam : undefined;
  const pendingOnly = first(sp.view) !== "all";

  const [uid, members, pending, { rows, names, error }] = await Promise.all([
    getUserId(),
    listMembers(),
    listExpenses({ status: "submitted", limit: 200 }),
    listExpenses({ status: status as ExpenseStatus | undefined, userId, fromDate: r.first, toDate: `${month}-${String(r.daysInMonth).padStart(2, "0")}` }),
  ]);
  const admin = isAdminRole(role);
  const t = totalsByStatus(rows);
  const back = `/expenses/approvals?${new URLSearchParams({ month, view: pendingOnly ? "pending" : "all", ...(status ? { status } : {}), ...(userId ? { user: userId } : {}) }).toString()}`;
  const exportHref = `/expenses/export?${new URLSearchParams({ month, ...(status ? { status } : {}), ...(userId ? { user: userId } : {}) }).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/expenses" className="link text-sm">← Mis gastos</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Aprobación de gastos</h1>
          <div className="segmented">
            <Link href="/expenses/approvals" aria-current={pendingOnly ? "true" : undefined}>Pendientes ({pending.rows.length})</Link>
            <Link href="/expenses/approvals?view=all" aria-current={!pendingOnly ? "true" : undefined}>Histórico</Link>
          </div>
        </div>
        <p className="page-sub">Nadie aprueba sus propios gastos (solo el propietario puede). Los responsables ven los de su equipo.</p>
      </div>

      {typeof sp.error === "string" && <p role="alert" className="alert-error">{sp.error}</p>}

      {pendingOnly ? (
        <ExpenseTable rows={pending.rows} names={pending.names} back="/expenses/approvals" currentUserId={uid} showPerson canDecide canReimburse={admin} empty="No hay gastos pendientes de aprobar. 🎉" />
      ) : (
        <>
          <form method="get" className="card toolbar">
            <input type="hidden" name="view" value="all" />
            <label className="field">Mes<input type="month" name="month" defaultValue={month} className="input" /></label>
            <label className="field">
              Persona
              <select name="user" defaultValue={userId ?? ""} className="input">
                <option value="">Todas</option>
                {members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name}</option>))}
              </select>
            </label>
            <label className="field">
              Estado
              <select name="status" defaultValue={status ?? ""} className="input">
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
              </select>
            </label>
            <button type="submit" className="btn btn-secondary">Filtrar</button>
            {admin && <a href={exportHref} className="btn btn-secondary">Exportar CSV</a>}
          </form>
          <ul className="flex flex-wrap gap-6 text-sm">
            <li>Pendiente: <strong>{formatMoney(t.submitted)}</strong></li>
            <li>Aprobado: <strong>{formatMoney(t.approved)}</strong></li>
            <li>Reembolsado: <strong>{formatMoney(t.reimbursed)}</strong></li>
            <li>Rechazado: <strong>{formatMoney(t.rejected)}</strong></li>
          </ul>
          {error && <p role="alert" className="alert-error">No se pudieron cargar los gastos.</p>}
          <ExpenseTable rows={rows} names={names} back={back} currentUserId={uid} showPerson canDecide canReimburse={admin} />
        </>
      )}
    </div>
  );
}
