import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { listTasks, TASKS_PAGE_SIZE } from "@/lib/modules/tasks/queries";
import { TaskTable } from "@/components/tasks/TaskTable";
import { inputClass } from "@/components/form-styles";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  const scope = first(sp.scope) === "team" ? "team" : "mine";
  const stateParam = first(sp.state);
  const state = stateParam === "done" || stateParam === "all" ? stateParam : "open";
  const q = first(sp.q) ?? "";
  const page = Number.parseInt(first(sp.page) ?? "1", 10) || 1;

  const [role, { rows, total, names, error, page: current }] = await Promise.all([
    getCurrentRole(),
    listTasks({ scope, state, q, page }),
  ]);

  const params = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { scope, state, q, page: String(current), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/tasks?${p.toString()}`;
  };
  const pages = Math.max(1, Math.ceil(total / TASKS_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Tareas</h1>
        <div className="flex items-center gap-3">
          <div className="segmented">
            <Link href={params({ scope: "mine", page: "1" })} aria-current={scope === "mine" ? "true" : undefined}>Mis tareas</Link>
            <Link href={params({ scope: "team", page: "1" })} aria-current={scope === "team" ? "true" : undefined}>Equipo</Link>
          </div>
          {role && canWrite(role) && (
            <Link href="/tasks/new" className="btn btn-primary">
              Nueva tarea
            </Link>
          )}
        </div>
      </div>

      <form method="get" role="search" className="card toolbar">
        <input type="hidden" name="scope" value={scope} />
        <label className="field">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Título" className={`${inputClass} h-10 w-64`} />
        </label>
        <label className="field">
          Mostrar
          <select name="state" defaultValue={state} className={`${inputClass} h-10`}>
            <option value="open">Abiertas</option>
            <option value="done">Hechas / canceladas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">Filtrar</button>
      </form>

      {error && <p role="alert" className="alert-error">No se pudieron cargar las tareas.</p>}

      <TaskTable
        rows={rows}
        names={names}
        back={params({})}
        canWrite={!!role && canWrite(role)}
        empty={scope === "mine" ? "No tienes tareas asignadas." : "No hay tareas."}
      />

      <div className="flex items-center justify-between text-sm">
        <span>{total} tarea{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-3">
          {current > 1 ? <Link href={params({ page: String(current - 1) })} className="link">Anterior</Link> : <span className="text-slate-400">Anterior</span>}
          <span>Página {current} de {pages}</span>
          {current < pages ? <Link href={params({ page: String(current + 1) })} className="link">Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
        </div>
      </div>
    </div>
  );
}
