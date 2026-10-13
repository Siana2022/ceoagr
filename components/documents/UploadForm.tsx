"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/form-styles";
import type { DocFormState } from "@/lib/modules/documents/types";

type Props = {
  action: (prev: DocFormState, fd: FormData) => Promise<DocFormState>;
  caseId?: string;
  contactId?: string;
  back?: string;
  withTags?: boolean;
  label?: string;
};

export function UploadForm({ action, caseId, contactId, back, withTags = true, label = "Subir" }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {caseId && <input type="hidden" name="case_id" value={caseId} />}
      {contactId && <input type="hidden" name="contact_id" value={contactId} />}
      {back && <input type="hidden" name="back" value={back} />}
      <label className="flex flex-col gap-1 text-sm">
        Archivo (máx. 20 MB)
        <input name="file" type="file" required className="text-sm" />
      </label>
      {withTags && (
        <label className="flex flex-col gap-1 text-sm">
          Etiquetas
          <input name="tags" placeholder="contrato, plano" className={`${inputClass} h-10 w-48`} />
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[5px] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand hover:text-white disabled:opacity-60"
      >
        {pending ? "Subiendo…" : label}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
