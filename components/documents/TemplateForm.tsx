"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import { TEMPLATE_VARIABLES } from "@/lib/modules/documents/render";
import type { DocFormState, Template } from "@/lib/modules/documents/types";

type Props = {
  action: (prev: DocFormState, fd: FormData) => Promise<DocFormState>;
  caseTypes: { id: string; name: string }[];
  template?: Template;
  submitLabel: string;
};

export function TemplateForm({ action, caseTypes, template, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="card flex max-w-3xl flex-col gap-4 p-6">
      {state?.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}
      <label className="field">
        Nombre *
        <input name="name" required defaultValue={template?.name ?? ""} className={inputClass} />
      </label>
      <label className="field">
        Tipo de expediente (opcional)
        <select name="case_type_id" defaultValue={template?.case_type_id ?? ""} className={inputClass}>
          <option value="">Cualquiera</option>
          {caseTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
      </label>
      <label className="field">
        Contenido (HTML)
        <textarea
          name="body"
          rows={16}
          defaultValue={template?.body ?? ""}
          className={`${inputClass} font-mono text-xs`}
          placeholder="<h1>Propuesta {{case.code}}</h1><p>Estimado/a {{contact.name}}:</p>"
        />
      </label>
      <div className="rounded-xl bg-slate-50 p-3 text-xs">
        <p className="mb-1 font-medium">Variables disponibles</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
          {TEMPLATE_VARIABLES.map((v) => (<span key={v}>{`{{${v}}}`}</span>))}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-44">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Guardando…" : submitLabel}
          </button>
        </div>
        <Link href="/settings/templates" className="link text-sm">Cancelar</Link>
      </div>
    </form>
  );
}
