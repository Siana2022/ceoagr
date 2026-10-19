import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { listCaseTypes } from "@/lib/modules/cases/queries";
import { getWebhookSecret, listAutomationRuns, listAutomations } from "@/lib/modules/automations/queries";
import { deleteAutomation, regenerateWebhookSecret, setAutomationActive } from "@/lib/modules/automations/actions";
import { STAGES } from "@/lib/modules/opportunities/types";
import { fmtDateTime } from "@/lib/modules/format";

export default async function AutomationsPage({ searchParams }: PageProps<"/settings/automations">) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");
  const sp = await searchParams;

  const [types, automations, secret, runs] = await Promise.all([
    listCaseTypes(true),
    listAutomations(),
    getWebhookSecret(),
    listAutomationRuns(20),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const stageLabel = new Map<string, string>(STAGES.map((s) => [s.key, s.label]));
  const statusLabel = (a: (typeof automations)[number]) => {
    if (a.entity === "opportunity") return stageLabel.get(a.to_status) ?? a.to_status;
    const type = types.find((t) => t.id === a.case_type_id);
    return type?.pipeline.find((p) => p.key === a.to_status)?.label ?? a.to_status;
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Automatizaciones</h1>
            <p className="page-sub">
              Cuando un expediente o una oportunidad llega a un estado, crea una tarea y/o avisa a tu n8n (o cualquier webhook) sin que nadie tenga que hacerlo a mano.
            </p>
          </div>
          <Link href="/settings/automations/new" className="btn btn-primary">Nueva automatización</Link>
        </div>
      </div>

      {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}
      {sp.secret_regenerated && <p role="status" className="alert-ok">Clave de firma regenerada. Actualízala en tu n8n.</p>}

      <section className="card flex flex-col gap-3 p-6">
        <h2 className="section-title">Clave de firma de los webhooks</h2>
        <p className="text-sm text-muted">
          Cada webhook se envía con la cabecera <code className="var-chip">X-Signature: sha256=…</code>, calculada con esta clave sobre el cuerpo de la petición.
          Configúrala en n8n (nodo de validación de firma HMAC) para comprobar que la llamada viene realmente de tu aplicación.
        </p>
        <p className="font-mono text-sm">{secret ?? "No se pudo obtener la clave."}</p>
        <form action={regenerateWebhookSecret}>
          <button type="submit" className="btn btn-secondary btn-sm">Regenerar clave</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Reglas configuradas</h2>
        <div className="table-card">
          <table>
            <thead><tr><th>Nombre</th><th>Cuándo</th><th>Acciones</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {automations.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/settings/automations/${a.id}`} className="link">{a.name}</Link></td>
                  <td>
                    {a.entity === "case" ? "Expediente" : "Oportunidad"}
                    {a.entity === "case" && a.case_type_id && <> · {typeName.get(a.case_type_id) ?? "tipo eliminado"}</>}
                    {" → "}{statusLabel(a)}
                  </td>
                  <td className="text-xs text-muted">
                    {a.actions.map((act) => (act.type === "create_task" ? "Crear tarea" : "Webhook")).join(" · ")}
                  </td>
                  <td>{a.active ? "Activa" : <span className="text-muted">Desactivada</span>}</td>
                  <td className="text-right">
                    <form action={setAutomationActive.bind(null, a.id, !a.active)} className="inline">
                      <button type="submit" className="link mr-3 text-sm">{a.active ? "Desactivar" : "Activar"}</button>
                    </form>
                    <form action={deleteAutomation.bind(null, a.id)} className="inline">
                      <button type="submit" className="link-danger text-sm">Eliminar</button>
                    </form>
                  </td>
                </tr>
              ))}
              {automations.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted">Aún no hay automatizaciones.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Últimas ejecuciones</h2>
        <div className="table-card">
          <table>
            <thead><tr><th>Cuándo</th><th>Acción</th><th>Estado</th><th>Detalle</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums">{fmtDateTime(r.created_at)}</td>
                  <td>{r.action_type === "create_task" ? "Crear tarea" : r.action_type === "webhook" ? "Webhook" : r.action_type}</td>
                  <td>{r.status === "ok" ? <span className="text-success">Correcto</span> : <span className="text-danger">Error</span>}</td>
                  <td className="text-xs text-muted">{r.detail ?? "—"}</td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">Todavía no se ha ejecutado ninguna.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
