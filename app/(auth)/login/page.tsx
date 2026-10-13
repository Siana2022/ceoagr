import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { buttonClass, inputClass } from "@/components/form-styles";
import { login } from "../actions";

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error, message } = await searchParams;

  return (
    <AuthShell title="Bienvenido de nuevo" subtitle="Accede con tu cuenta para continuar.">
      {typeof error === "string" && <p role="alert" className="alert-error">{error}</p>}
      {typeof message === "string" && <p role="status" className="alert-ok">{message}</p>}
      <form action={login} className="flex flex-col gap-4">
        <label className="field">
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="field">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
        <button type="submit" className={`${buttonClass} mt-2`}>Entrar</button>
      </form>
      <p className="text-sm text-slate-500">
        ¿No tienes cuenta? <Link href="/signup" className="link">Regístrate</Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      <LoginContent searchParams={props.searchParams} />
    </Suspense>
  );
}
