import { Suspense } from "react";
import Link from "next/link";
import { signup } from "../actions";
import { buttonClass, inputClass } from "../form-styles";

async function SignupPageContent({
  searchParams,
}: Pick<PageProps<"/signup">, "searchParams">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      {typeof error === "string" && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}
      <form action={signup} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre completo
          <input name="full_name" required autoComplete="name" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>Crear cuenta</button>
      </form>
      <p className="text-sm">
        ¿Ya tienes cuenta? <Link href="/login" className="underline">Inicia sesión</Link>
      </p>
    </main>
  );
}

export default function SignupPage(props: PageProps<"/signup">) {
  return (
    <Suspense fallback={null}>
      <SignupPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
