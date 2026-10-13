import Link from "next/link";
import { listNotifications } from "@/lib/modules/time/queries";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/modules/time/actions";
import { fmtDateTime } from "@/lib/modules/format";

function text(kind: string, p: Record<string, unknown>) {
  if (kind === "budget_alert") {
    const over = Number(p.pct) >= 100;
    return {
      title: `${over ? "Presupuesto de horas superado" : "Presupuesto de horas en riesgo"}: ${String(p.code)}`,
      body: `${String(p.title)} lleva ${String(p.hours)} h de ${String(p.budget)} h (${String(p.pct)}%).`,
      href: p.case_id ? `/cases/${String(p.case_id)}` : null,
      danger: over,
    };
  }
  return { title: kind, body: "", href: null, danger: false };
}

export default async function NotificationsPage() {
  const items = await listNotifications();
  const unread = items.filter((i) => !i.read_at).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="page-sub">{unread ? `${unread} sin leer` : "Estás al día."}</p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="btn btn-secondary">Marcar todas como leídas</button>
          </form>
        )}
      </div>

      <ul className="card flex max-w-3xl flex-col divide-y divide-slate-100">
        {items.map((n) => {
          const t = text(n.kind, n.payload);
          return (
            <li key={n.id} className="flex items-start gap-3 p-4">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-slate-200" : t.danger ? "bg-red-500" : "bg-amber-500"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.read_at ? "" : "font-semibold"}`}>{t.title}</p>
                <p className="text-sm text-muted">{t.body}</p>
                <p className="mt-1 text-xs text-muted">{fmtDateTime(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                {t.href && <Link href={t.href} className="link">Ver</Link>}
                {!n.read_at && (
                  <form action={markNotificationRead.bind(null, n.id)}>
                    <button type="submit" className="link">Marcar leída</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="p-8 text-center text-sm text-muted">No tienes notificaciones.</li>}
      </ul>
    </div>
  );
}
