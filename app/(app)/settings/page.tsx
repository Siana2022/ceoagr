import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, ROLE_LABELS, type AppRole } from "@/lib/modules/nav";
import { CONFIGURABLE_FIELDS, FIELD_LABELS } from "@/lib/modules/contacts/schema";
import { getRequiredFields } from "@/lib/modules/contacts/queries";
import { saveRequiredFields } from "@/lib/modules/contacts/actions";
import { buttonClass } from "@/components/form-styles";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("current_user_role");
  if (!role || !isStaffRole(role as AppRole)) redirect("/");

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, active, created_at")
    .order("created_at");

  const required = await getRequiredFields();
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Ajustes</h1>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-semibold">Contactos: campos obligatorios</h2>
        <p className="text-sm text-zinc-500">El nombre y el tipo son siempre obligatorios. Marca qué otros campos deben rellenarse.</p>
        {sp.saved && <p role="status" className="text-sm text-green-700">Cambios guardados.</p>}
        {sp.error && <p role="alert" className="text-sm text-red-600">No se pudieron guardar los cambios.</p>}
        <form action={saveRequiredFields} className="flex flex-col gap-2">
          {CONFIGURABLE_FIELDS.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="required" value={f} defaultChecked={required.includes(f)} />
              {FIELD_LABELS[f]}
            </label>
          ))}
          <div className="mt-2 w-40">
            <button type="submit" className={buttonClass}>Guardar</button>
          </div>
        </form>
      </section>

      <h2 className="text-lg font-semibold">Equipo</h2>
      <table className="w-full max-w-2xl text-left text-sm">
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className="py-2 font-medium">Nombre</th>
            <th className="py-2 font-medium">Rol</th>
            <th className="py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {(members ?? []).map((m) => (
            <tr key={m.user_id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2">{names.get(m.user_id) || "Sin nombre"}</td>
              <td className="py-2">{ROLE_LABELS[m.role as AppRole]}</td>
              <td className="py-2">{m.active ? "Activo" : "Inactivo"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
