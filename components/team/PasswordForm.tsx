"use client";

import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import type { AccountFormState } from "@/lib/modules/team/types";

export function PasswordForm({ action }: { action: (prev: AccountFormState, fd: FormData) => Promise<AccountFormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form key={state?.ok ? "ok" : "form"} action={formAction} className="card flex max-w-md flex-col gap-4 p-6">
      {state?.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state?.ok && <p role="status" className="alert-ok">Contraseña cambiada correctamente.</p>}
      <label className="field">
        Nueva contraseña
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
      <label className="field">
        Repite la contraseña
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
      <div className="w-48">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}
