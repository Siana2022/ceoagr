"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import { FIELD_LABELS, type ConfigurableField } from "@/lib/modules/contacts/schema";
import type { Contact, ContactFormState } from "@/lib/modules/contacts/types";

type Props = {
  action: (prev: ContactFormState, fd: FormData) => Promise<ContactFormState>;
  required: string[];
  contact?: Contact;
  cancelHref: string;
  submitLabel: string;
};

type FieldProps = {
  name: string;
  label: string;
  values: Record<string, string>;
  errors: Record<string, string>;
  type?: string;
  isRequired?: boolean;
};

function Field({ name, label, values, errors, type = "text", isRequired = false }: FieldProps) {
  return (
    <label className="field">
      <span>
        {label}
        {isRequired && <span aria-hidden="true"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={isRequired}
        defaultValue={values[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        className={inputClass}
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </label>
  );
}

function initialValues(c?: Contact): Record<string, string> {
  if (!c) return { kind: "person" };
  return {
    kind: c.kind,
    name: c.name,
    legal_name: c.legal_name ?? "",
    tax_id: c.tax_id ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    mobile: c.mobile ?? "",
    source: c.source ?? "",
    tags: c.tags.join(", "),
    address_street: c.address.street ?? "",
    address_city: c.address.city ?? "",
    address_postal_code: c.address.postal_code ?? "",
    address_province: c.address.province ?? "",
    address_country: c.address.country ?? "",
  };
}

export function ContactForm({ action, required, contact, cancelHref, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.values ?? initialValues(contact);
  const errors = state?.fieldErrors ?? {};

  const req = (f: ConfigurableField) => required.includes(f);

  return (
    <form action={formAction} className="card flex max-w-2xl flex-col gap-4 p-6">
      {state?.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}

      <label className="field">
        Tipo *
        <select name="kind" defaultValue={values.kind ?? "person"} className={inputClass}>
          <option value="person">Persona</option>
          <option value="company">Empresa</option>
        </select>
        {errors.kind && <span className="field-error">{errors.kind}</span>}
      </label>

      <Field values={values} errors={errors} name="name" label="Nombre" isRequired />
      <Field values={values} errors={errors} name="legal_name" label={FIELD_LABELS.legal_name} isRequired={req("legal_name")} />
      <Field values={values} errors={errors} name="tax_id" label={FIELD_LABELS.tax_id} isRequired={req("tax_id")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field values={values} errors={errors} name="email" type="email" label={FIELD_LABELS.email} isRequired={req("email")} />
        <Field values={values} errors={errors} name="phone" type="tel" label={FIELD_LABELS.phone} isRequired={req("phone")} />
        <Field values={values} errors={errors} name="mobile" type="tel" label={FIELD_LABELS.mobile} isRequired={req("mobile")} />
        <Field values={values} errors={errors} name="source" label={FIELD_LABELS.source} isRequired={req("source")} />
      </div>

      <Field values={values} errors={errors} name="tags" label="Etiquetas (separadas por comas)" />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Dirección</legend>
        <div className="sm:col-span-2">
          <Field values={values} errors={errors} name="address_street" label="Calle" />
        </div>
        <Field values={values} errors={errors} name="address_postal_code" label="Código postal" />
        <Field values={values} errors={errors} name="address_city" label="Ciudad" />
        <Field values={values} errors={errors} name="address_province" label="Provincia" />
        <Field values={values} errors={errors} name="address_country" label="País" />
      </fieldset>

      <div className="flex items-center gap-4">
        <div className="w-40">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Guardando…" : submitLabel}
          </button>
        </div>
        <Link href={cancelHref} className="link text-sm">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
