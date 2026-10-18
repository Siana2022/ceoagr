import Link from "next/link";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { getBlockedTaskIds, getUserId, listTasks, TASKS_PAGE_SIZE } from "@/lib/modules/tasks/queries";
import { listViews } from "@/lib/modules/views/queries";
import { SavedViewsBar, SaveViewForm, ViewMessages } from "@/components/views/SavedViews";
import { TaskTable } from "@/components/tasks/TaskTable";
import { TaskBoard, type BoardCard } from "@/components/tasks/TaskBoard";
import { inputClass } from "@/components/form-styles";
import { fmtDate, todayMadrid } from "@/lib/modules/format";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  const scope = first(sp.scope) === "team" ? "team" : "mine";
  const board = first(sp.view) === "board";
  const stateParam = first(sp.state);
  const state = stateParam === "done" || stateParam === "all" ? stateParam : "open";
  const q = first(sp.q) ?? "";
  const page = Number.parseInt(first(sp.page) ?? "1", 10) || 1;

  const [role, uid, views] = await Promise.all([getCurrentRole(), getUserId(), listViews("tasks")]);
  const writable = !!role && canWrite(role);
  const staff = !!role && isStaffRole(role);
  const currentFilters = Object.fromEntries(
    Object.entries({ scope, state, q }).filter(([, v]) => v),
  );

  const params = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { scope, state: board ? undefined : state, q, view: board ? "board" : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/tasks?${p.toString()}`;
  };

  let cards: BoardCard[] = [];
  let list: Awaited<ReturnType<typeof listTasks>> | null = null;
  let blocked = new Set<string>();

  if (board) {
    const [open, done] = await Promise.all([
      listTasks({ scope, state: "open", q, limit: 300 }),
      listTasks({ scope, state: "done", q, limit: 30 }),
    ]);
    const all = [...open.rows, ...done.rows.filter((t) => t.status === "done")];
    blocked = await getBlockedTaskIds(all.map((t) => t.id));
    const today = todayMadrid();
    const names = new Map([...open.names, ...done.names]);
    cards = all.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as BoardCard["status"],
      priority: t.priority,
      due: t.due_at ? fmtDate(t.due_at) : null,
      overdue: !!t.due_at && t.due_at.slice(0, 10) < today && t.status !== "done",
      blocked: blocked.has(t.id),
      assignee: (t.assignee_id && names.get(t.assignee_id)) || null,
      code: t.cases?.code ?? null,
    }));
  } else {
    list = await listTasks({ scope, state, q, page });
    blocked = await getBlockedTaskIds(list.rows.map((t) => t.id));
  }

  const pages = list ? Math.max(1, Math.ceil(list.total / TASKS_PAGE_SIZE)) : 1;
  const current = list?.page ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Tareas</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="segmented">
            <Link href={params({ scope: "mine", page: "1" })} aria-current={scope === "mine" ? "true" : undefined}>Mis tareas</Link>
            <Link href={params({ scope: "team", page: "1" })} aria-current={scope === "team" ? "true" : undefined}>Equipo</Link>
          </div>
          <div className="segmented">
            <Link href={params({ view: undefined, page: "1" })} aria-current={!board ? "true" : undefined}>Lista</Link>
            <Link href={params({ view: "board", page: "1" })} aria-current={board ? "true" : undefined}>Tablero</Link>
          </div>
          <Link href="/tasks/planning" className="btn btn-secondary">Planificación (Gantt)</Link>
          {writable && <Link href="/tasks/new" className="btn btn-primary">Nueva tarea</Link>}
        </div>
      </div>

      {!board && (
        <>
          <ViewMessages saved={sp.view_saved} error={sp.view_error} />
          <SavedViewsBar entity="tasks" basePath="/tasks" views={views} uid={uid} />
        </>
      )}

      <form method="get" role="search" className="card toolbar">
        <input type="hidden" name="scope" value={scope} />
        {board && <input type="hidden" name="view" value="board" />}
        <label className="field">
          Buscar
          <input name="q" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore defaultValue={q} placeholder="Título" className={`${inputClass} w-64`} />
        </label>
        {!board && (
          <label className="field">
            Mostrar
            <select name="state" defaultValue={state} className={inputClass}>
              <option value="open">Abiertas</option>
              <option value="done">Hechas / canceladas</option>
              <option value="all">Todas</option>
            </select>
          </label>
        )}
        <button type="submit" className="btn btn-secondary">Filtrar</button>
      </form>

      {!board && writable && (
        <SaveViewForm entity="tasks" filters={currentFilters} canShare={staff} placeholder="Ej.: Pendientes de esta semana" />
      )}

      {list?.error && <p role="alert" className="alert-error">No se pudieron cargar las tareas.</p>}

      {board ? (
        <>
          <TaskBoard cards={cards} canWrite={writable} />
          <p className="text-xs text-muted">
            Arrastra las tarjetas entre columnas (o usa el selector). «Hecha» muestra las 30 más recientes. Las tareas canceladas no aparecen en el tablero.
          </p>
        </>
      ) : list ? (
        <>
          <TaskTable
            rows={list.rows}
            names={list.names}
            back={params({ page: String(current) })}
            canWrite={writable}
            blocked={blocked}
            empty={scope === "mine" ? "No tienes tareas asignadas." : "No hay tareas."}
          />
          <div className="flex items-center justify-between text-sm">
            <span>{list.total} tarea{list.total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-3">
              {current > 1 ? <Link href={params({ page: String(current - 1) })} className="link">Anterior</Link> : <span className="text-slate-400">Anterior</span>}
              <span>Página {current} de {pages}</span>
              {current < pages ? <Link href={params({ page: String(current + 1) })} className="link">Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
