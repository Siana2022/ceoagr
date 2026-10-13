import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonClass, inputClass } from "@/components/form-styles";
import { createOrganization } from "./actions";

async function OnboardingPageContent({
  searchParams,
}: Pick<PageProps<"/onboarding">, "searchParams">) {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (orgId) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Crea tu organización</h1>
      {typeof error === "string" && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}
      <form action={createOrganization} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input name="name" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Identificador (slug)
          <input name="slug" required pattern="[a-z0-9\-]{3,40}" className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>Crear organización</button>
      </form>
    </main>
  );
}

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={null}>
      <OnboardingPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
