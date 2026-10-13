"use client";

import { useActionState } from "react";
import { addManualEntry } from "@/lib/modules/time/actions";
import type { TimeFormState } from "@/lib/modules/time/types";

type Props = {
  cases: { id: string; code: string; title: string }[];
  tasks: { id: string; title: string; cases: { code: string } | null }[];
  today: string;
  presetCase?: string;
};

export function ManualEntryForm({ cases, tasks, today, presetCase }: Props) {
  const [state, formAction, pending] = useActionState<TimeFormState, FormData>(addManualEntry, undefined);
  const v = state?.values ?? {};

  return (
    <form key={state?.ok ? "ok" : "form"} action={formAction} className="flex flex-col gap-4">
      {state?.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state?.ok && <p role="status" className="alert-ok">Horas guardadas.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field">
          Fecha *
          <input name="date" type="date" required defaultValue={v.date ?? today} className="input" />
        </label>
        <label className="field">
          Hora de inicio *
          <input name="start" type="time" required defaultValue={v.start ?? "09:00"} className="input" />
        </label>
        <label className="field">
          Duración * <span className="font-normal text-muted">(1:30, 1,5 o 90m)</span>
          <input name="duration" required defaultValue={v.duration ?? ""} className="input" placeholder="1:30" />
        </label>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="billable" defaultChecked={v.billable ? v.billable === "on" : true} /> Facturable
        </label>
        <label className="field lg:col-span-2">
          Expediente
          <select name="case_id" defaultValue={v.case_id ?? presetCase ?? ""} className="input">
            <option value="">Sin expediente (tiempo interno)</option>
            {cases.map((c) => (<option key={c.id} value={c.id}>{c.code} · {c.title}</option>))}
          </select>
        </label>
        <label className="field lg:col-span-2">
          Tarea (opcional)
          <select name="task_id" defaultValue={v.task_id ?? ""} className="input">
            <option value="">—</option>
            {tasks.map((t) => (<option key={t.id} value={t.id}>{t.cases?.code ? `${t.cases.code} · ` : ""}{t.title}</option>))}
          </select>
        </label>
        <label className="field sm:col-span-2 lg:col-span-4">
          Descripción
          <input name="description" defaultValue={v.description ?? ""} className="input" placeholder="¿Qué has hecho?" />
        </label>
      </div>
      <div>
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : "Añadir horas"}</button>
      </div>
    </form>
  );
}
