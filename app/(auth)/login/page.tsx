import { Suspense } from "react";
import Link from "next/link";
import { login } from "../actions";
import { buttonClass, inputClass } from "../form-styles";

async function LoginPageContent({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { error, message } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      {typeof error === "string" && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}
      {typeof message === "string" && (
        <p role="status" className="text-sm text-green-700">{message}</p>
      )}
      <form action={login} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>Entrar</button>
      </form>
      <p className="text-sm">
        ¿No tienes cuenta? <Link href="/signup" className="underline">Regístrate</Link>
      </p>
    </main>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      <LoginPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
