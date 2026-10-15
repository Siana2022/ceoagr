import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, NAV_ITEMS, ROLE_LABELS, type AppRole } from "@/lib/modules/nav";
import { Brand } from "@/components/Brand";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { countUnreadNotifications } from "@/lib/modules/time/queries";
import { countPendingApprovals } from "@/lib/modules/expenses/queries";
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

  const [unread, pendingExpenses] = await Promise.all([
    countUnreadNotifications(),
    isStaffRole(membership.role as AppRole) ? countPendingApprovals() : Promise.resolve(0),
  ]);
  const badges = { "/expenses": pendingExpenses };
  const role = membership.role as AppRole;
  const org = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;
  const items = NAV_ITEMS.filter((i) => !i.staffOnly || isStaffRole(role));
  const displayName = profile?.full_name || user.email || "Usuario";

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MobileNav items={items} orgName={org?.name ?? ""} badges={badges} />

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-white md:flex">
        <div className="px-6 pb-6 pt-7">
          <Brand light />
        </div>
        <div className="px-6 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {org?.name}
        </div>
        <Sidebar items={items} badges={badges} />

        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Link href="/account" title="Mi perfil" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:bg-white/8">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-sidebar">
                {initials(displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{displayName}</span>
                <span className="block truncate text-xs text-white/55">{ROLE_LABELS[role]}</span>
              </span>
            </Link>
            <Link href="/notifications" title="Notificaciones" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`} className="relative rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
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
        <div className="mx-auto w-full max-w-7xl p-5 md:p-8">
          <div className="mb-6 flex justify-end">
            <GlobalSearch />
          </div>
          {children}
        </div>
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
