import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listRates } from "@/lib/modules/time/queries";
import { deleteRate, saveRate } from "@/lib/modules/time/actions";
import { formatMoney } from "@/lib/modules/time/calc";
import { fmtDate, todayMadrid } from "@/lib/modules/format";

export default async function RatesPage({ searchParams }: PageProps<"/settings/rates">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const [sp, members, rates] = await Promise.all([searchParams, listMembers(), listRates()]);
  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const current = new Map<string, (typeof rates)[number]>();
  const today = todayMadrid();
  for (const r of rates) {
    if (r.valid_from <= today && !current.has(r.user_id)) current.set(r.user_id, r);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <h1 className="page-title mt-1">Tarifas por profesional</h1>
        <p className="page-sub">
          El <strong>coste/hora</strong> es lo que cuesta cada persona a la empresa; el <strong>precio/hora</strong>, lo que vale su hora facturada.
          Solo propietarios y administradores ven estos datos. Cada tarifa rige desde su fecha, así que el histórico no cambia.
        </p>
      </div>
      {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}
      {sp.error && <p role="alert" className="alert-error">No se pudo guardar la tarifa. Revisa los datos.</p>}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Tarifa vigente</h2>
        <div className="table-card">
          <table>
            <thead><tr><th>Persona</th><th>Coste / hora</th><th>Precio / hora</th><th>Desde</th></tr></thead>
            <tbody>
              {members.map((m) => {
                const r = current.get(m.user_id);
                return (
                  <tr key={m.user_id}>
                    <td className="font-medium">{m.full_name}</td>
                    <td className="tabular-nums">{r ? formatMoney(r.cost_per_hour) : <span className="text-amber-600">Sin tarifa</span>}</td>
                    <td className="tabular-nums">{r ? formatMoney(r.price_per_hour) : "—"}</td>
                    <td>{r ? fmtDate(r.valid_from) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flex max-w-2xl flex-col gap-4 p-6">
        <h2 className="section-title">Añadir o cambiar una tarifa</h2>
        <form action={saveRate} className="grid gap-4 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            Persona
            <select name="user_id" required className="input">
              {members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name}</option>))}
            </select>
          </label>
          <label className="field">Coste / hora (€)<input name="cost_per_hour" required inputMode="decimal" className="input" placeholder="35" /></label>
          <label className="field">Precio / hora (€)<input name="price_per_hour" required inputMode="decimal" className="input" placeholder="75" /></label>
          <label className="field">Vigente desde<input name="valid_from" type="date" required defaultValue={today} className="input" /></label>
          <div className="flex items-end"><button type="submit" className="btn btn-primary">Guardar tarifa</button></div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Histórico</h2>
        <div className="table-card">
          <table>
            <thead><tr><th>Persona</th><th>Desde</th><th>Coste</th><th>Precio</th><th /></tr></thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>{names.get(r.user_id) ?? "—"}</td><td>{fmtDate(r.valid_from)}</td>
                  <td className="tabular-nums">{formatMoney(r.cost_per_hour)}</td><td className="tabular-nums">{formatMoney(r.price_per_hour)}</td>
                  <td className="text-right"><form action={deleteRate.bind(null, r.id)}><button type="submit" className="link-danger text-sm">Eliminar</button></form></td>
                </tr>
              ))}
              {rates.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted">Aún no hay tarifas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
