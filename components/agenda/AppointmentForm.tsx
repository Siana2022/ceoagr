"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import { madridParts } from "@/lib/modules/format";
import {
  APPOINTMENT_STATUS_LABELS,
  type AgendaFormState,
  type Appointment,
  type Resource,
} from "@/lib/modules/agenda/types";

type Props = {
  action: (prev: AgendaFormState, fd: FormData) => Promise<AgendaFormState>;
  resources: Resource[];
  contacts: { id: string; name: string }[];
  cases: { id: string; code: string; title: string }[];
  appointment?: Appointment;
  preset?: { date?: string; resource_id?: string; contact_id?: string; case_id?: string };
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
    <label className="flex flex-col gap-1 text-sm">
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
      {errors[name] && <span className="text-xs text-red-600">{errors[name]}</span>}
    </label>
  );
}

export function AppointmentForm({
  action,
  resources,
  contacts,
  cases,
  appointment,
  preset,
  back,
  cancelHref,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const start = appointment ? madridParts(appointment.starts_at) : null;
  const end = appointment ? madridParts(appointment.ends_at) : null;
  const values: Record<string, string> =
    state?.values ?? {
      title: appointment?.title ?? "",
      resource_id: appointment?.resource_id ?? preset?.resource_id ?? resources[0]?.id ?? "",
      contact_id: appointment?.contact_id ?? preset?.contact_id ?? "",
      case_id: appointment?.case_id ?? preset?.case_id ?? "",
      date: start?.date ?? preset?.date ?? "",
      start: start?.time ?? "09:00",
      end: end?.time ?? "10:00",
      status: appointment?.status ?? "pending",
      notes: appointment?.notes ?? "",
    };
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {back && <input type="hidden" name="back" value={back} />}

      <Field name="title" label="Título" values={values} errors={errors} required />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Recurso *
          <select name="resource_id" required defaultValue={values.resource_id} className={inputClass}>
            {resources.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
          {errors.resource_id && <span className="text-xs text-red-600">{errors.resource_id}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Estado
          <select name="status" defaultValue={values.status} className={inputClass}>
            {Object.entries(APPOINTMENT_STATUS_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </label>
        <Field name="date" label="Fecha" type="date" values={values} errors={errors} required />
        <div className="grid grid-cols-2 gap-4">
          <Field name="start" label="Inicio" type="time" values={values} errors={errors} required />
          <Field name="end" label="Fin" type="time" values={values} errors={errors} required />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Contacto
          <select name="contact_id" defaultValue={values.contact_id} className={inputClass}>
            <option value="">—</option>
            {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Expediente
          <select name="case_id" defaultValue={values.case_id} className={inputClass}>
            <option value="">—</option>
            {cases.map((c) => (<option key={c.id} value={c.id}>{c.code} · {c.title}</option>))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Notas
        <textarea name="notes" rows={3} defaultValue={values.notes ?? ""} className={inputClass} />
      </label>

      <div className="flex items-center gap-4">
        <div className="w-44">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Guardando…" : submitLabel}
          </button>
        </div>
        <Link href={cancelHref} className="text-sm underline">Cancelar</Link>
      </div>
    </form>
  );
}
