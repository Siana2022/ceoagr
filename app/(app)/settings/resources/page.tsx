import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { listResources } from "@/lib/modules/agenda/queries";
import { createResource, updateResource } from "@/lib/modules/agenda/actions";
import { RESOURCE_KIND_LABELS } from "@/lib/modules/agenda/types";
import { buttonClass, inputClass } from "@/components/form-styles";

export default async function ResourcesPage({ searchParams }: PageProps<"/settings/resources">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const [sp, resources] = await Promise.all([searchParams, listResources(true)]);

  const kindSelect = (def: string) => (
    <select name="kind" defaultValue={def} aria-label="Tipo" className={`${inputClass} w-40`}>
      {Object.entries(RESOURCE_KIND_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
    </select>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm underline">← Ajustes</Link>
        <h1 className="mt-1 text-xl font-semibold">Recursos de la agenda</h1>
      </div>
      {sp.saved && <p role="status" className="text-sm text-green-700">Cambios guardados.</p>}
      {sp.error && <p role="alert" className="text-sm text-red-600">No se pudieron guardar los cambios.</p>}

      <ul className="flex flex-col gap-3">
        {resources.map((r) => (
          <li key={r.id}>
            <form action={updateResource.bind(null, r.id)} className="flex flex-wrap items-center gap-2">
              <input name="name" required defaultValue={r.name} aria-label="Nombre" className={`${inputClass} w-56`} />
              {kindSelect(r.kind)}
              <input type="color" name="color" defaultValue={r.color} aria-label="Color" className="h-9 w-12 rounded border border-zinc-300" />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="active" defaultChecked={r.active} /> Activo
              </label>
              <button type="submit" className="rounded-[5px] border border-brand px-3 py-1.5 text-sm text-brand hover:bg-brand hover:text-white">Guardar</button>
            </form>
          </li>
        ))}
        {resources.length === 0 && <li className="text-sm text-zinc-500">Aún no hay recursos.</li>}
      </ul>

      <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6">
        <h2 className="text-lg font-semibold">Nuevo recurso</h2>
        <form action={createResource} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input name="name" required className={`${inputClass} w-56`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Tipo
            {kindSelect("professional")}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Color
            <input type="color" name="color" defaultValue="#003366" className="h-9 w-12 rounded border border-zinc-300" />
          </label>
          <div className="w-40"><button type="submit" className={buttonClass}>Crear</button></div>
        </form>
      </section>
    </div>
  );
}
