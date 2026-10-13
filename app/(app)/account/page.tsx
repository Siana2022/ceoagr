import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { ROLE_LABELS } from "@/lib/modules/nav";
import { changeOwnPassword } from "@/lib/modules/team/actions";
import { PasswordForm } from "@/components/team/PasswordForm";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [role, { data: profile }] = await Promise.all([
    getCurrentRole(),
    supabase.from("profiles").select("full_name").eq("user_id", user?.id ?? "").maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Mi perfil</h1>
        <p className="page-sub">{profile?.full_name} · {user?.email} · {role ? ROLE_LABELS[role] : ""}</p>
      </div>
      <h2 className="section-title">Cambiar contraseña</h2>
      <PasswordForm action={changeOwnPassword} />
    </div>
  );
}
