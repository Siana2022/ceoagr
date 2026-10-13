import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { buttonClass, inputClass } from "@/components/form-styles";
import { createOrganization } from "./actions";

async function OnboardingContent({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (orgId) redirect("/");

  const { error } = await searchParams;

  return (
    <AuthShell title="Crea tu organización" subtitle="Será el espacio de trabajo de tu equipo.">
      {typeof error === "string" && <p role="alert" className="alert-error">{error}</p>}
      <form action={createOrganization} className="flex flex-col gap-4">
        <label className="field">
          Nombre
          <input name="name" required className={inputClass} />
        </label>
        <label className="field">
          Identificador (slug)
          <input name="slug" required pattern="[a-z0-9\-]{3,40}" className={inputClass} />
          <span className="text-xs font-normal text-slate-500">Minúsculas, números y guiones. Ej.: agr-valencia</span>
        </label>
        <button type="submit" className={`${buttonClass} mt-2`}>Crear organización</button>
      </form>
    </AuthShell>
  );
}

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={null}>
      <OnboardingContent searchParams={props.searchParams} />
    </Suspense>
  );
}
