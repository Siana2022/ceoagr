import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { createClient } from "@/lib/supabase/server";
import { listResources } from "@/lib/modules/agenda/queries";
import { createResource, updateResource } from "@/lib/modules/agenda/actions";
import { RESOURCE_KIND_LABELS } from "@/lib/modules/agenda/types";
import { buttonClass, inputClass } from "@/components/form-styles";

export default async function ResourcesPage({ searchParams }: PageProps<"/settings/resources">) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) redirect("/settings");
  const supabase = await createClient();
  const [sp, resources, { data: org }] = await Promise.all([
    searchParams,
    listResources(true),
    supabase.from("organizations").select("slug").maybeSingle(),
  ]);
  const bookingBase = `/book/${org?.slug ?? ""}`;

  const kindSelect = (def: string) => (
    <select name="kind" defaultValue={def} aria-label="Tipo" className={`${inputClass} w-40`}>
      {Object.entries(RESOURCE_KIND_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
    </select>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <h1 className="page-title mt-1">Recursos de la agenda</h1>
        <p className="page-sub">Marca «Reservable online» para que un recurso aparezca en la página pública de reserva de citas.</p>
      </div>
      {sp.saved && <p role="status" className="alert-ok">Cambios guardados.</p>}
      {sp.error && <p role="alert" className="alert-error">No se pudieron guardar los cambios.</p>}

      <ul className="flex flex-col gap-3">
        {resources.map((r) => (
          <li key={r.id} className="card flex flex-col gap-2 p-4">
            <form action={updateResource.bind(null, r.id)} className="flex flex-wrap items-center gap-2">
              <input name="name" required defaultValue={r.name} aria-label="Nombre" className={`${inputClass} w-56`} />
              {kindSelect(r.kind)}
              <input type="color" name="color" defaultValue={r.color} aria-label="Color" className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="active" defaultChecked={r.active} /> Activo
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="public_booking" defaultChecked={r.public_booking} /> Reservable online
              </label>
              <label className="flex items-center gap-1 text-sm">
                Hueco (min)
                <input type="number" name="slot_minutes" min={5} max={480} defaultValue={r.slot_minutes} className={`${inputClass} w-20`} />
              </label>
              <button type="submit" className="btn btn-secondary btn-sm">Guardar</button>
            </form>
            {r.public_booking && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <Link href={`/settings/resources/${r.id}/availability`} className="link text-sm">Configurar horarios</Link>
                <span>
                  Enlace público: <a href={`${bookingBase}/${r.id}`} target="_blank" rel="noreferrer" className="link font-mono">{bookingBase}/{r.id}</a>
                </span>
              </div>
            )}
          </li>
        ))}
        {resources.length === 0 && <li className="text-sm text-muted">Aún no hay recursos.</li>}
      </ul>

      <section className="card flex flex-col gap-3 p-6">
        <h2 className="section-title">Nuevo recurso</h2>
        <form action={createResource} className="flex flex-wrap items-end gap-2">
          <label className="field">
            Nombre
            <input name="name" required className={`${inputClass} w-56`} />
          </label>
          <label className="field">
            Tipo
            {kindSelect("professional")}
          </label>
          <label className="field">
            Color
            <input type="color" name="color" defaultValue="#003366" className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
          </label>
          <label className="field">
            Hueco (min)
            <input type="number" name="slot_minutes" min={5} max={480} defaultValue={60} className={`${inputClass} w-20`} />
          </label>
          <div className="w-40"><button type="submit" className={buttonClass}>Crear</button></div>
        </form>
      </section>
    </div>
  );
}
