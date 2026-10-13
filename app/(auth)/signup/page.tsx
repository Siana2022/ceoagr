import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { buttonClass, inputClass } from "@/components/form-styles";
import { signup } from "../actions";

async function SignupContent({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { error } = await searchParams;

  return (
    <AuthShell title="Crea tu cuenta" subtitle="Empieza en menos de un minuto.">
      {typeof error === "string" && <p role="alert" className="alert-error">{error}</p>}
      <form action={signup} className="flex flex-col gap-4">
        <label className="field">
          Nombre completo
          <input name="full_name" required autoComplete="name" className={inputClass} />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="field">
          Contraseña
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          <span className="text-xs font-normal text-slate-500">Mínimo 8 caracteres.</span>
        </label>
        <button type="submit" className={`${buttonClass} mt-2`}>Crear cuenta</button>
      </form>
      <p className="text-sm text-slate-500">
        ¿Ya tienes cuenta? <Link href="/login" className="link">Inicia sesión</Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage(props: PageProps<"/signup">) {
  return (
    <Suspense fallback={null}>
      <SignupContent searchParams={props.searchParams} />
    </Suspense>
  );
}
