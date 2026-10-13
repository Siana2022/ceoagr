"use client";

import Link from "next/link";
import { useActionState } from "react";
import { toDateInput } from "@/lib/modules/format";
import { STAGES, type OppFormState, type Opportunity } from "@/lib/modules/opportunities/types";
import type { Member } from "@/lib/modules/members";

type Props = {
  action: (prev: OppFormState, fd: FormData) => Promise<OppFormState>;
  contacts: { id: string; name: string }[];
  members: Member[] | null;
  opp?: Opportunity;
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
  step?: string;
  required?: boolean;
  placeholder?: string;
};

function Field({ name, label, values, errors, type = "text", step, required, placeholder }: FieldProps) {
  return (
    <label className="field">
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={values[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        className="input"
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </label>
  );
}

export function OpportunityForm({ action, contacts, members, opp, presetContact, cancelHref, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values: Record<string, string> =
    state?.values ?? {
      contact_id: opp?.contact_id ?? presetContact ?? "",
      title: opp?.title ?? "",
      stage: opp?.stage ?? "lead",
      expected_value: opp?.expected_value != null ? String(opp.expected_value) : "",
      probability: opp?.probability != null ? String(opp.probability) : "",
      owner_id: opp?.owner_id ?? "",
      expected_close: toDateInput(opp?.expected_close ? `${opp.expected_close}T12:00:00Z` : null),
      source: opp?.source ?? "",
      notes: opp?.notes ?? "",
      lost_reason: opp?.lost_reason ?? "",
    };
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="card flex max-w-2xl flex-col gap-4 p-6">
      {state?.error && <p role="alert" className="alert-error">{state.error}</p>}

      <label className="field">
        <span>Cliente <span aria-hidden="true">*</span></span>
        <select name="contact_id" required defaultValue={values.contact_id} className="input">
          <option value="">Selecciona un contacto…</option>
          {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        {errors.contact_id && <span className="field-error">{errors.contact_id}</span>}
      </label>

      <Field name="title" label="Título" values={values} errors={errors} required placeholder="Ej.: Proyecto de instalación eléctrica nave 3" />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Fase
          <select name="stage" defaultValue={values.stage} className="input">
            {STAGES.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
          </select>
        </label>
        <Field name="expected_value" label="Valor estimado (€)" type="number" step="0.01" values={values} errors={errors} />
        <Field name="probability" label="Probabilidad de éxito (%)" type="number" values={values} errors={errors} placeholder="Según la fase" />
        <Field name="expected_close" label="Cierre previsto" type="date" values={values} errors={errors} />
        <Field name="source" label="Origen" values={values} errors={errors} placeholder="Web, recomendación, licitación…" />
        {members && (
          <label className="field">
            Responsable
            <select name="owner_id" defaultValue={values.owner_id} className="input">
              <option value="">Yo (por defecto)</option>
              {members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name}</option>))}
            </select>
          </label>
        )}
      </div>

      <label className="field">
        Notas
        <textarea name="notes" rows={3} defaultValue={values.notes} className="input" />
      </label>

      <label className="field">
        Motivo de pérdida (solo si la fase es «Perdida»)
        <input name="lost_reason" defaultValue={values.lost_reason} className="input" />
        {errors.lost_reason && <span className="field-error">{errors.lost_reason}</span>}
      </label>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : submitLabel}</button>
        <Link href={cancelHref} className="link text-sm">Cancelar</Link>
      </div>
    </form>
  );
}
