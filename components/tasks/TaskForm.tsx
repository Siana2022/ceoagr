"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import { toDateInput } from "@/lib/modules/format";
import { PRIORITY_LABELS } from "@/lib/modules/cases/types";
import { TASK_STATUS_LABELS, type Task, type TaskFormState } from "@/lib/modules/tasks/types";
import type { Member } from "@/lib/modules/members";

type Props = {
  action: (prev: TaskFormState, fd: FormData) => Promise<TaskFormState>;
  members: Member[];
  cases: { id: string; code: string; title: string }[];
  contacts: { id: string; name: string }[];
  task?: Task;
  preset?: { case_id?: string; contact_id?: string; parent_task_id?: string; assignee_id?: string };
  back?: string;
  cancelHref: string;
  submitLabel: string;
};

type FieldProps = {
  name: string;
  label: string;
  values: Record<string, string>;
  errors: Record<string, string>;
  type?: string;
  required?: boolean;
};

function Field({ name, label, values, errors, type = "text", required }: FieldProps) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={values[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        className={inputClass}
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </label>
  );
}

export function TaskForm({ action, members, cases, contacts, task, preset, back, cancelHref, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values: Record<string, string> =
    state?.values ?? {
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "todo",
      priority: task?.priority ?? "normal",
      assignee_id: task?.assignee_id ?? preset?.assignee_id ?? "",
      case_id: task?.case_id ?? preset?.case_id ?? "",
      contact_id: task?.contact_id ?? preset?.contact_id ?? "",
      start_at: toDateInput(task?.start_at),
      due_at: toDateInput(task?.due_at),
      estimate_minutes: task?.estimate_minutes != null ? String(task.estimate_minutes) : "",
    };
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="card flex max-w-2xl flex-col gap-4 p-6">
      {state?.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}
      {back && <input type="hidden" name="back" value={back} />}
      {preset?.parent_task_id && <input type="hidden" name="parent_task_id" value={preset.parent_task_id} />}

      <Field name="title" label="Título" values={values} errors={errors} required />

      <label className="field">
        Descripción
        <textarea name="description" rows={3} defaultValue={values.description ?? ""} className={inputClass} />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Estado
          <select name="status" defaultValue={values.status} className={inputClass}>
            {Object.entries(TASK_STATUS_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </label>
        <label className="field">
          Prioridad
          <select name="priority" defaultValue={values.priority} className={inputClass}>
            {Object.entries(PRIORITY_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </label>
        <label className="field">
          Asignada a
          <select name="assignee_id" defaultValue={values.assignee_id} className={inputClass}>
            <option value="">Sin asignar</option>
            {members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name}</option>))}
          </select>
        </label>
        <Field name="estimate_minutes" label="Estimación (minutos)" type="number" values={values} errors={errors} />
        <Field name="start_at" label="Inicio" type="date" values={values} errors={errors} />
        <Field name="due_at" label="Vencimiento" type="date" values={values} errors={errors} />
        <label className="field">
          Expediente
          <select name="case_id" defaultValue={values.case_id} className={inputClass}>
            <option value="">—</option>
            {cases.map((c) => (<option key={c.id} value={c.id}>{c.code} · {c.title}</option>))}
          </select>
        </label>
        <label className="field">
          Contacto
          <select name="contact_id" defaultValue={values.contact_id} className={inputClass}>
            <option value="">—</option>
            {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-44">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Guardando…" : submitLabel}
          </button>
        </div>
        <Link href={cancelHref} className="link text-sm">Cancelar</Link>
      </div>
    </form>
  );
}
