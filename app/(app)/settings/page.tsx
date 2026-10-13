import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, ROLE_LABELS, type AppRole } from "@/lib/modules/nav";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("current_user_role");
  if (!role || !isAdminRole(role as AppRole)) redirect("/");

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, active, created_at")
    .order("created_at");

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Ajustes · Equipo</h1>
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
