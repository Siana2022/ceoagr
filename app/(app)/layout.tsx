import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, NAV_ITEMS, ROLE_LABELS, type AppRole } from "@/lib/modules/nav";
import { Brand } from "@/components/Brand";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { logout } from "../(auth)/actions";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organizations(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = membership.role as AppRole;
  const org = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;
  const items = NAV_ITEMS.filter((i) => !i.staffOnly || isStaffRole(role));
  const displayName = profile?.full_name || user.email || "Usuario";

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MobileNav items={items} orgName={org?.name ?? ""} />

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-white md:flex">
        <div className="px-6 pb-6 pt-7">
          <Brand light />
        </div>
        <div className="px-6 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {org?.name}
        </div>
        <Sidebar items={items} />

        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-sidebar">
              {initials(displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-white/55">{ROLE_LABELS[role]}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl p-5 md:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
