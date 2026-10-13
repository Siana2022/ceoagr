import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, NAV_ITEMS, ROLE_LABELS, type AppRole } from "@/lib/modules/nav";
import { Sidebar } from "@/components/Sidebar";
import { logout } from "../(auth)/actions";

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

  const role = membership.role as AppRole;
  const org = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;
  const items = NAV_ITEMS.filter((i) => !i.staffOnly || isStaffRole(role));

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 md:block dark:border-zinc-800">
        <div className="px-6 py-4 font-semibold">{org?.name}</div>
        <Sidebar items={items} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <span className="font-semibold md:hidden">{org?.name}</span>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span>
              {user.email} · {ROLE_LABELS[role]}
            </span>
            <form action={logout}>
              <button type="submit" className="underline">
                Salir
              </button>
            </form>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </div>
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
