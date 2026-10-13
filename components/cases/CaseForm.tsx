"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import { toDateInput } from "@/lib/modules/format";
import {
  PRIORITY_LABELS,
  type CaseFormState,
  type CaseRow,
  type CaseType,
  type SchemaField,
} from "@/lib/modules/cases/types";
import type { Member } from "@/lib/modules/members";

type Props = {
  action: (prev: CaseFormState, fd: FormData) => Promise<CaseFormState>;
  type: CaseType;
  contacts: { id: string; name: string }[];
  members: Member[] | null; // null: user cannot reassign owner
  kase?: CaseRow;
  presetContact?: string;
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
  step?: string;
};

function Field({ name, label, values, errors, type = "text", required, step }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={values[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        className={inputClass}
      />
      {errors[name] && <span className="text-xs text-red-600">{errors[name]}</span>}
    </label>
  );
}

function CustomField({
  field,
  values,
  errors,
}: {
  field: SchemaField;
  values: Record<string, string>;
  errors: Record<string, string>;
}) {
  const name = `cf_${field.key}`;
  const err = errors[name] && <span className="text-xs text-red-600">{errors[name]}</span>;

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} defaultChecked={values[name] === "on"} />
        {field.label}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span>
          {field.label}
          {field.required && <span aria-hidden="true"> *</span>}
        </span>
        <select name={name} required={field.required} defaultValue={values[name] ?? ""} className={inputClass}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {err}
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span>
          {field.label}
          {field.required && <span aria-hidden="true"> *</span>}
        </span>
        <textarea name={name} rows={3} required={field.required} defaultValue={values[name] ?? ""} className={inputClass} />
        {err}
      </label>
    );
  }
  return (
    <Field
      name={name}
      label={field.label}
      values={values}
      errors={errors}
      required={field.required}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      step={field.type === "number" ? "any" : undefined}
    />
  );
}

function initialValues(type: CaseType, kase?: CaseRow, presetContact?: string) {
  const v: Record<string, string> = {
    contact_id: kase?.contact_id ?? presetContact ?? "",
    title: kase?.title ?? "",
    priority: kase?.priority ?? "normal",
    due_at: toDateInput(kase?.due_at),
    budget_hours: kase?.budget_hours != null ? String(kase.budget_hours) : "",
    owner_id: kase?.owner_id ?? "",
  };
  for (const f of type.custom_schema) {
    const raw = kase?.custom_fields?.[f.key];
    v[`cf_${f.key}`] = f.type === "boolean" ? (raw ? "on" : "") : raw == null ? "" : String(raw);
  }
  return v;
}

export function CaseForm({ action, type, contacts, members, kase, presetContact, cancelHref, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.values ?? initialValues(type, kase, presetContact);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <input type="hidden" name="case_type_id" value={type.id} />

      <label className="flex flex-col gap-1 text-sm">
        Contacto *
        <select name="contact_id" required defaultValue={values.contact_id ?? ""} className={inputClass}>
          <option value="">Selecciona un contacto…</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.contact_id && <span className="text-xs text-red-600">{errors.contact_id}</span>}
      </label>

      <Field name="title" label="Título" values={values} errors={errors} required />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Prioridad
          <select name="priority" defaultValue={values.priority ?? "normal"} className={inputClass}>
            {Object.entries(PRIORITY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <Field name="due_at" label="Fecha límite" type="date" values={values} errors={errors} />
        <Field name="budget_hours" label="Horas presupuestadas" type="number" step="0.25" values={values} errors={errors} />
        {members && (
          <label className="flex flex-col gap-1 text-sm">
            Responsable
            <select name="owner_id" defaultValue={values.owner_id ?? ""} className={inputClass}>
              <option value="">Yo (por defecto)</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {type.custom_schema.length > 0 && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Datos de {type.label_singular.toLowerCase()}</legend>
          {type.custom_schema.map((f) => (
            <CustomField key={f.key} field={f} values={values} errors={errors} />
          ))}
        </fieldset>
      )}

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
