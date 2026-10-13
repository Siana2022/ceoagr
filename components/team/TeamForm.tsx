"use client";

import { useActionState, useState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import { ROLE_LABELS } from "@/lib/modules/nav";
import { ASSIGNABLE_ROLES } from "@/lib/modules/team/schema";
import type { MemberFormState } from "@/lib/modules/team/types";

export function Credentials({ email, password, title }: { email?: string; password: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email ? `Email: ${email}\nContraseña: ${password}` : password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div role="status" className="alert-ok flex flex-col gap-2">
      <p className="font-semibold">{title}</p>
      {email && <p>Email: <span className="font-mono">{email}</span></p>}
      <p>Contraseña temporal: <span className="font-mono text-base font-semibold">{password}</span></p>
      <p className="text-xs">Se muestra una sola vez. Cópiala y envíasela por un canal seguro; podrá cambiarla desde su perfil.</p>
      <div>
        <button type="button" onClick={copy} className="btn btn-secondary btn-sm">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export function TeamForm({ action }: { action: (prev: MemberFormState, fd: FormData) => Promise<MemberFormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.values ?? {};
  const errors = state?.fieldErrors ?? {};

  return (
    <div className="flex flex-col gap-4">
      {state?.created && (
        <Credentials
          title={`Usuario creado: ${state.created.name}`}
          email={state.created.email}
          password={state.created.password}
        />
      )}
      {state?.error && <p role="alert" className="alert-error">{state.error}</p>}

      <form key={state?.created ? "done" : "form"} action={formAction} className="card flex max-w-2xl flex-col gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Nombre completo *
            <input name="full_name" required defaultValue={values.full_name ?? ""} aria-invalid={errors.full_name ? true : undefined} className={inputClass} />
            {errors.full_name && <span className="field-error">{errors.full_name}</span>}
          </label>
          <label className="field">
            Email *
            <input name="email" type="email" required defaultValue={values.email ?? ""} aria-invalid={errors.email ? true : undefined} className={inputClass} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label className="field">
            Rol *
            <select name="role" defaultValue={values.role ?? "member"} className={inputClass}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Contraseña temporal
            <input name="password" type="text" autoComplete="off" defaultValue={values.password ?? ""} placeholder="Déjalo vacío para generar una" className={inputClass} />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>
        </div>
        <div className="w-44">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}
