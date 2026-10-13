"use client";

import { useActionState } from "react";
import { Credentials } from "@/components/team/TeamForm";
import type { PasswordResetState } from "@/lib/modules/team/types";

export function ResetPassword({ action }: { action: () => Promise<PasswordResetState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <button type="submit" disabled={pending} className="link text-sm">
          {pending ? "Generando…" : "Restablecer contraseña"}
        </button>
      </form>
      {state?.error && <p role="alert" className="alert-error text-xs">{state.error}</p>}
      {state?.password && <Credentials title="Nueva contraseña" password={state.password} />}
    </div>
  );
}
