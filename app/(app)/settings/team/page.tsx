import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAdminKey } from "@/lib/supabase/admin";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole, ROLE_LABELS, type AppRole } from "@/lib/modules/nav";
import { ASSIGNABLE_ROLES } from "@/lib/modules/team/schema";
import { createMember, resetMemberPassword, setMemberActive, updateMemberRole } from "@/lib/modules/team/actions";
import { fmtDate } from "@/lib/modules/format";
import { ResetPassword } from "@/components/team/ResetPassword";
import { TeamForm } from "@/components/team/TeamForm";
import { inputClass } from "@/components/form-styles";

export default async function TeamPage() {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) redirect("/settings");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, active, created_at")
    .order("created_at");
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/settings" className="link text-sm">← Ajustes</Link>
        <h1 className="page-title mt-1">Equipo</h1>
        <p className="page-sub">Crea los usuarios de tu organización. Nadie puede registrarse por su cuenta.</p>
      </div>

      {!hasAdminKey() && (
        <p role="alert" className="alert-error max-w-2xl">
          Para crear usuarios hay que configurar la clave <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> en el servidor.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Añadir usuario</h2>
        <TeamForm action={createMember} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Usuarios ({members?.length ?? 0})</h2>
        <div className="table-card">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Rol</th><th>Estado</th><th>Alta</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => {
                const isSelf = m.user_id === user?.id;
                const locked = isSelf || m.role === "owner";
                return (
                  <tr key={m.user_id}>
                    <td className="font-medium">{names.get(m.user_id) || "Sin nombre"}{isSelf && <span className="ml-2 text-xs text-muted">(tú)</span>}</td>
                    <td>
                      {locked ? (
                        ROLE_LABELS[m.role as AppRole]
                      ) : (
                        <form action={updateMemberRole.bind(null, m.user_id)} className="flex items-center gap-2">
                          <select name="role" defaultValue={m.role} aria-label="Rol" className={`${inputClass} h-8 w-40 text-xs`}>
                            {ASSIGNABLE_ROLES.map((r) => (<option key={r} value={r}>{ROLE_LABELS[r]}</option>))}
                          </select>
                          <button type="submit" className="btn btn-secondary btn-sm">Guardar</button>
                        </form>
                      )}
                    </td>
                    <td>{m.active ? "Activo" : <span className="text-danger">Desactivado</span>}</td>
                    <td>{fmtDate(m.created_at)}</td>
                    <td>
                      {locked ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <ResetPassword action={resetMemberPassword.bind(null, m.user_id)} />
                          <form action={setMemberActive.bind(null, m.user_id, !m.active)}>
                            <button type="submit" className={m.active ? "link-danger text-sm" : "link text-sm"}>
                              {m.active ? "Desactivar" : "Reactivar"}
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
