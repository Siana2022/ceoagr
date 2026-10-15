import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { getUserId, listCaseOptions } from "@/lib/modules/tasks/queries";
import { getExpenseRates, listExpenses } from "@/lib/modules/expenses/queries";
import { totalsByStatus } from "@/lib/modules/expenses/calc";
import { monthRange, isMonth } from "@/lib/modules/clock/calc";
import { formatMoney } from "@/lib/modules/time/calc";
import { todayMadrid } from "@/lib/modules/format";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const sp = await searchParams;
  const today = todayMadrid();
  const monthParam = first(sp.month);
  const month = isMonth(monthParam) ? monthParam : today.slice(0, 7);
  const r = monthRange(month);
  const uid = await getUserId();
  const role = await getCurrentRole();
  const writable = !!role && canWrite(role);

  const [rates, cases, { rows, names, error }] = await Promise.all([
    getExpenseRates(),
    listCaseOptions(),
    listExpenses({ userId: uid ?? undefined, fromDate: r.first, toDate: `${month}-${String(r.daysInMonth).padStart(2, "0")}` }),
  ]);
  const t = totalsByStatus(rows);
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", month: "long", year: "numeric" });
  const nav = "btn btn-secondary btn-sm";

  const kpis = [
    { label: "Pendiente de aprobar", value: t.submitted },
    { label: "Aprobado, por reembolsar", value: t.approved },
    { label: "Reembolsado", value: t.reimbursed },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Mis gastos</h1>
          <p className="page-sub">Kilometraje, dietas y otros gastos de viaje, con su ticket.</p>
        </div>
        {role && isStaffRole(role) && <Link href="/expenses/approvals" className="btn btn-secondary">Aprobaciones</Link>}
      </div>

      {sp.error && <p role="alert" className="alert-error">{String(sp.error)}</p>}

      {writable && (
        <details open className="card p-6">
          <summary className="section-title cursor-pointer">Nuevo gasto</summary>
          <div className="mt-4"><ExpenseForm cases={cases} rates={rates} today={today} /></div>
        </details>
      )}

      <ul className="grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <li key={k.label} className="card p-5">
            <p className="text-sm text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{formatMoney(k.value)}</p>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title capitalize">{monthLabel}</h2>
          <div className="flex items-center gap-2">
            <Link href={`/expenses?month=${r.prev}`} className={nav} aria-label="Mes anterior">←</Link>
            <Link href="/expenses" className={nav}>Este mes</Link>
            <Link href={`/expenses?month=${r.nextMonth}`} className={nav} aria-label="Mes siguiente">→</Link>
          </div>
        </div>
        {error && <p role="alert" className="alert-error">No se pudieron cargar los gastos. ¿Está aplicada la migración?</p>}
        <ExpenseTable rows={rows} names={names} back={`/expenses?month=${month}`} currentUserId={uid} empty="No has registrado gastos este mes." />
      </section>
    </div>
  );
}
