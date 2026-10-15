"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveTaskAction } from "@/lib/modules/tasks/actions";

export type BoardCard = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: string;
  due: string | null; // display text
  overdue: boolean;
  blocked: boolean;
  assignee: string | null;
  code: string | null;
};

const COLUMNS = [
  { key: "todo", label: "Pendiente", dot: "bg-slate-400" },
  { key: "in_progress", label: "En curso", dot: "bg-sky-600" },
  { key: "done", label: "Hecha", dot: "bg-emerald-600" },
] as const;

const PRIORITY_DOT: Record<string, string> = { urgent: "bg-red-500", high: "bg-orange-500", normal: "bg-slate-300", low: "bg-slate-200" };

export function TaskBoard({ cards, canWrite }: { cards: BoardCard[]; canWrite: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(cards, (state, m: { id: string; status: BoardCard["status"] }) =>
    state.map((c) => (c.id === m.id ? { ...c, status: m.status } : c)),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function move(id: string, status: BoardCard["status"]) {
    const card = optimistic.find((c) => c.id === id);
    if (!card || card.status === status) return;
    startTransition(async () => {
      setOptimistic({ id, status });
      await moveTaskAction(id, status);
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = optimistic.filter((c) => c.status === col.key);
        return (
          <section
            key={col.key}
            aria-label={col.label}
            onDragOver={(e) => { if (canWrite) { e.preventDefault(); setOver(col.key); } }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain") || dragging;
              if (id) move(id, col.key);
              setDragging(null);
            }}
            className={`rounded-xl p-3 transition-colors ${over === col.key ? "bg-sky-50 ring-2 ring-sky-300" : "bg-slate-100"}`}
          >
            <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />{col.label}</span>
              <span className="text-muted">{list.length}</span>
            </h2>
            <ul className="flex min-h-24 flex-col gap-2">
              {list.map((c) => (
                <li
                  key={c.id}
                  draggable={canWrite}
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setDragging(c.id); }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  className={`card p-3 text-sm ${canWrite ? "cursor-grab active:cursor-grabbing" : ""} ${dragging === c.id ? "opacity-40" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[c.priority] ?? "bg-slate-300"}`} title={`Prioridad ${c.priority}`} />
                    <Link href={`/tasks/${c.id}`} className={`link ${c.status === "done" ? "line-through opacity-60" : ""}`}>{c.title}</Link>
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {c.code && <span>{c.code}</span>}
                    {c.assignee && <span>{c.assignee}</span>}
                    {c.due && <span className={c.overdue ? "font-semibold text-danger" : ""}>{c.overdue ? "Vencida · " : "Vence "}{c.due}</span>}
                    {c.blocked && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">Bloqueada</span>}
                  </p>
                  {canWrite && (
                    <select
                      aria-label={`Mover «${c.title}»`}
                      value={c.status}
                      onChange={(e) => move(c.id, e.target.value as BoardCard["status"])}
                      className="input mt-2 h-8 text-xs"
                    >
                      {COLUMNS.map((o) => (<option key={o.key} value={o.key}>{o.label}</option>))}
                    </select>
                  )}
                </li>
              ))}
              {list.length === 0 && <li className="py-6 text-center text-xs text-slate-400">Sin tareas</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
