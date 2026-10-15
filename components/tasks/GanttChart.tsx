import Link from "next/link";
import { monthSpans, type Gantt } from "@/lib/modules/tasks/gantt";

const ROW = 40;
const HEAD = 56;
const STATUS_COLOR = { todo: "#64748b", in_progress: "#0369a1", done: "#15803d", cancelled: "#94a3b8" } as const;
const STATUS_LABEL = { todo: "Pendiente", in_progress: "En curso", done: "Hecha", cancelled: "Cancelada" } as const;

const monthName = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", month: "short", year: "numeric" });

export function GanttChart({ gantt, unit }: { gantt: Gantt; unit: number }) {
  const { days, rows, arrows, todayIdx } = gantt;
  const width = days.length * unit;
  const height = HEAD + rows.length * ROW;
  const weekly = unit < 20;

  return (
    <div className="table-card">
      <div className="flex">
        <div className="w-64 shrink-0 border-r border-slate-200 bg-white">
          <div className="flex items-end border-b border-slate-200 bg-slate-50 px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted" style={{ height: HEAD }}>
            Tarea
          </div>
          {rows.map((r) => (
            <div key={r.task.id} className="flex items-center gap-2 border-b border-slate-100 px-4 text-sm" style={{ height: ROW }}>
              <Link href={`/tasks/${r.task.id}`} className={`link truncate ${r.task.status === "done" ? "line-through opacity-60" : ""}`} title={r.task.title}>
                {r.task.title}
              </Link>
              {r.blocked && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Bloqueada</span>}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width, height }}>
            {/* month header */}
            <div className="absolute left-0 right-0 top-0 flex border-b border-slate-200 bg-slate-50" style={{ height: HEAD }}>
              {monthSpans(days).map((m) => (
                <div key={m.label} className="absolute top-0 border-r border-slate-200 px-2 pt-1.5 text-xs font-semibold capitalize" style={{ left: m.startIdx * unit, width: m.span * unit }}>
                  {monthName(m.label)}
                </div>
              ))}
              {days.map((d, i) => {
                const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
                if (weekly && dow !== 1) return null;
                return (
                  <span key={d} className={`absolute bottom-1.5 text-center text-[10px] tabular-nums ${dow === 0 || dow === 6 ? "text-slate-400" : "text-muted"}`} style={{ left: i * unit, width: weekly ? unit * 7 : unit }}>
                    {Number(d.slice(8))}
                  </span>
                );
              })}
            </div>

            {/* weekend shading + row lines */}
            {days.map((d, i) => {
              const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
              return dow === 0 || dow === 6 ? (
                <div key={d} className="absolute bg-slate-50" style={{ left: i * unit, width: unit, top: HEAD, bottom: 0 }} />
              ) : null;
            })}
            {rows.map((r, i) => (
              <div key={r.task.id} className="absolute left-0 right-0 border-b border-slate-100" style={{ top: HEAD + (i + 1) * ROW - 1, height: 1 }} />
            ))}

            {todayIdx !== null && (
              <div className="absolute z-10 w-0.5 bg-red-500" style={{ left: todayIdx * unit + unit / 2, top: 0, bottom: 0 }}>
                <span className="absolute -left-4 top-0 rounded bg-red-500 px-1 text-[9px] font-bold uppercase text-white">Hoy</span>
              </div>
            )}

            {/* dependency arrows */}
            <svg className="pointer-events-none absolute left-0 top-0" width={width} height={height} aria-hidden="true">
              <defs>
                <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="#475569" />
                </marker>
              </defs>
              {arrows.map((a, i) => {
                const x1 = a.fromEnd * unit;
                const y1 = HEAD + a.fromRow * ROW + ROW / 2;
                const x2 = a.toStart * unit;
                const y2 = HEAD + a.toRow * ROW + ROW / 2;
                const mid = HEAD + Math.min(a.fromRow, a.toRow) * ROW + ROW;
                const d = x2 >= x1 + 12
                  ? `M${x1} ${y1} H${x1 + 6} V${y2} H${x2 - 1}`
                  : `M${x1} ${y1} H${x1 + 6} V${mid} H${x2 - 8} V${y2} H${x2 - 1}`;
                return <path key={i} d={d} fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#arrow)" />;
              })}
            </svg>

            {/* bars */}
            {rows.map((r, i) => {
              const color = STATUS_COLOR[r.task.status];
              const left = r.startIdx * unit;
              const w = Math.max(r.span * unit - 2, 10);
              const label = `${r.task.title} · ${STATUS_LABEL[r.task.status]}${r.task.assignee ? ` · ${r.task.assignee}` : ""}${r.overdue ? " · vencida" : ""}${r.blocked ? " · bloqueada" : ""}`;
              return (
                <Link
                  key={r.task.id}
                  href={`/tasks/${r.task.id}`}
                  title={label}
                  aria-label={label}
                  className="absolute z-[5] flex items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm"
                  style={{
                    left: r.milestone ? left + unit / 2 - 9 : left,
                    width: r.milestone ? 18 : w,
                    top: HEAD + i * ROW + 8,
                    height: r.milestone ? 18 : 24,
                    marginTop: r.milestone ? 3 : 0,
                    backgroundColor: color,
                    transform: r.milestone ? "rotate(45deg)" : undefined,
                    outline: r.overdue ? "2px solid #dc2626" : r.blocked ? "2px dashed #d97706" : undefined,
                    outlineOffset: 1,
                    opacity: r.task.status === "done" ? 0.55 : 1,
                  }}
                >
                  {!r.milestone && w > 90 && <span className="truncate">{r.task.title}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GanttLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
      {(["todo", "in_progress", "done"] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</li>
      ))}
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-slate-400 outline outline-2 outline-red-600" />Vencida</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-slate-400 outline outline-2 outline-dashed outline-amber-600" />Bloqueada por otra tarea</li>
      <li className="flex items-center gap-1.5"><span className="h-3 w-3 rotate-45 bg-slate-500" />Solo una fecha</li>
    </ul>
  );
}
