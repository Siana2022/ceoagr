import Link from "next/link";
import { globalSearch } from "@/lib/modules/search/queries";
import { stageInfo } from "@/lib/modules/opportunities/calc";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/modules/tasks/types";
import type { Stage } from "@/lib/modules/opportunities/types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Section({ title, count, all, children }: { title: string; count: number; all: string; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="card flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{title} <span className="text-sm font-normal text-muted">({count})</span></h2>
        {count > 6 && <Link href={all} className="link text-sm">Ver todos</Link>}
      </div>
      <ul className="flex flex-col divide-y divide-slate-100 text-sm">{children}</ul>
    </section>
  );
}

const row = "flex items-center justify-between gap-3 py-2.5";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const raw = first(sp.q) ?? "";
  const r = await globalSearch(raw);
  const enc = encodeURIComponent(r.q);
  const total = r.contacts.count + r.cases.count + r.tasks.count + r.opportunities.count + r.quotes.count + r.documents.count;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Búsqueda</h1>
        <p className="page-sub">
          {r.q.length < 2 ? "Escribe al menos 2 caracteres." : `${total} resultado${total === 1 ? "" : "s"} para «${r.q}»`}
        </p>
      </div>
      {r.q.length >= 2 && total === 0 && <p className="card p-8 text-center text-sm text-muted">No hay resultados. Prueba con otra palabra, un NIF o un código de expediente.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Contactos" count={r.contacts.count} all={`/contacts?q=${enc}`}>
          {r.contacts.items.map((c) => (
            <li key={c.id} className={row}><Link href={`/contacts/${c.id}`} className="link">{c.name}</Link><span className="truncate text-xs text-muted">{c.email ?? c.tax_id ?? ""}</span></li>
          ))}
        </Section>
        <Section title="Expedientes" count={r.cases.count} all={`/cases?q=${enc}`}>
          {r.cases.items.map((c) => (
            <li key={c.id} className={row}><span className="min-w-0"><Link href={`/cases/${c.id}`} className="link">{c.code}</Link> <span className="truncate">{c.title}</span></span><span className="shrink-0 text-xs text-muted">{c.contacts?.name}</span></li>
          ))}
        </Section>
        <Section title="Oportunidades" count={r.opportunities.count} all={`/opportunities?q=${enc}&view=table`}>
          {r.opportunities.items.map((o) => (
            <li key={o.id} className={row}><Link href={`/opportunities/${o.id}`} className="link">{o.title}</Link><span className="shrink-0 text-xs text-muted">{stageInfo(o.stage as Stage).label}</span></li>
          ))}
        </Section>
        <Section title="Presupuestos" count={r.quotes.count} all="/opportunities">
          {r.quotes.items.map((q) => (
            <li key={q.id} className={row}><Link href={`/quotes/${q.id}`} className="link">{q.number}</Link><span className="truncate text-xs text-muted">{q.title}</span></li>
          ))}
        </Section>
        <Section title="Tareas" count={r.tasks.count} all={`/tasks?scope=team&state=all&q=${enc}`}>
          {r.tasks.items.map((t) => (
            <li key={t.id} className={row}><Link href={`/tasks/${t.id}`} className="link">{t.title}</Link><span className="shrink-0 text-xs text-muted">{t.cases?.code ? `${t.cases.code} · ` : ""}{TASK_STATUS_LABELS[t.status as TaskStatus]}</span></li>
          ))}
        </Section>
        <Section title="Documentos" count={r.documents.count} all={`/documents?q=${enc}`}>
          {r.documents.items.map((d) => (
            <li key={d.id} className={row}><Link href={`/documents/${d.id}`} className="link">{d.name}</Link></li>
          ))}
        </Section>
      </div>
    </div>
  );
}
