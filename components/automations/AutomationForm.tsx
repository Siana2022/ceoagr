"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PRIORITY_LABELS } from "@/lib/modules/cases/types";
import type { CaseType } from "@/lib/modules/cases/types";
import { STAGES } from "@/lib/modules/opportunities/types";
import { actionsToFormValues } from "@/lib/modules/automations/schema";
import type { Automation, AutomationFormState } from "@/lib/modules/automations/types";

type Props = {
  action: (prev: AutomationFormState, fd: FormData) => Promise<AutomationFormState>;
  caseTypes: CaseType[];
  automation?: Automation;
  submitLabel: string;
};

export function AutomationForm({ action, caseTypes, automation, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.values ?? {};
  const errors = state?.fieldErrors ?? {};
  const prev = automation ? actionsToFormValues(automation.actions) : null;

  const [entity, setEntity] = useState<"case" | "opportunity">((values.entity as "case" | "opportunity") ?? automation?.entity ?? "case");
  const [caseTypeId, setCaseTypeId] = useState(values.case_type_id ?? automation?.case_type_id ?? "");
  const [createTask, setCreateTask] = useState(values.create_task ? values.create_task === "on" : (prev?.create_task ?? true));
  const [callWebhook, setCallWebhook] = useState(values.call_webhook ? values.call_webhook === "on" : (prev?.call_webhook ?? false));

  const selectedType = caseTypes.find((t) => t.id === caseTypeId);
  const statuses = entity === "case" ? (selectedType?.pipeline ?? []) : STAGES;

  return (
    <form action={formAction} className="card flex max-w-2xl flex-col gap-4 p-6">
      {state?.error && <p role="alert" className="alert-error">{state.error}</p>}
      {automation && <input type="hidden" name="active_present" value="1" />}

      <label className="field">
        Nombre *
        <input name="name" required defaultValue={values.name ?? automation?.name ?? ""} className="input" placeholder="Ej.: Al cerrar un expediente" />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Cuando…
          <select name="entity" value={entity} onChange={(e) => setEntity(e.target.value as "case" | "opportunity")} className="input">
            <option value="case">…un expediente cambie de estado</option>
            <option value="opportunity">…una oportunidad cambie de fase</option>
          </select>
        </label>

        {entity === "case" && (
          <label className="field">
            Tipo de expediente (opcional)
            <select name="case_type_id" value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value)} className="input">
              <option value="">Cualquier tipo</option>
              {caseTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </label>
        )}

        <label className="field">
          Llegue a…
          <select name="to_status" defaultValue={values.to_status ?? automation?.to_status ?? statuses[0]?.key ?? ""} className="input">
            {statuses.length === 0 && <option value="">Elige antes un tipo de expediente</option>}
            {statuses.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
          </select>
          {errors.to_status && <span className="field-error">{errors.to_status}</span>}
        </label>

        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={automation?.active ?? true} />
          Activa
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="create_task" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
          Crear una tarea
        </label>
        {createTask && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field sm:col-span-2">
              Título de la tarea *
              <input name="task_title" defaultValue={values.task_title ?? prev?.task_title ?? ""} className="input" placeholder="Ej.: Archivar el expediente" />
              {errors.task_title && <span className="field-error">{errors.task_title}</span>}
            </label>
            <label className="field">
              Asignar a
              <select name="task_assign_to" defaultValue={values.task_assign_to ?? prev?.task_assign_to ?? "owner"} className="input">
                <option value="owner">Responsable del expediente/oportunidad</option>
                <option value="none">Sin asignar</option>
              </select>
            </label>
            <label className="field">
              Plazo (días)
              <input name="task_due_offset_days" type="number" min={0} max={3650} defaultValue={values.task_due_offset_days ?? prev?.task_due_offset_days ?? ""} className="input" placeholder="Sin plazo" />
            </label>
            <label className="field">
              Prioridad
              <select name="task_priority" defaultValue={values.task_priority ?? prev?.task_priority ?? "normal"} className="input">
                {Object.entries(PRIORITY_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
              </select>
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="call_webhook" checked={callWebhook} onChange={(e) => setCallWebhook(e.target.checked)} />
          Llamar a un webhook (n8n u otro)
        </label>
        {callWebhook && (
          <label className="field">
            URL *
            <input name="webhook_url" defaultValue={values.webhook_url ?? prev?.webhook_url ?? ""} className="input" placeholder="https://tu-n8n.example.com/webhook/..." />
            {errors.webhook_url && <span className="field-error">{errors.webhook_url}</span>}
          </label>
        )}
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : submitLabel}</button>
        <Link href="/settings/automations" className="link text-sm">Cancelar</Link>
      </div>
    </form>
  );
}
