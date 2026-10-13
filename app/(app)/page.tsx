import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/modules/tasks/queries";
import { addDays, madridToUtc, todayMadrid } from "@/lib/modules/format";

export default async function HomePage() {
  const supabase = await createClient();
  const { count: members } = await supabase
    .from("memberships")
    .select("*", { count: "exact", head: true });

  const { count: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("archived", false);

  const [openCases, myTasks, todayAppts] = await Promise.all([
    supabase.from("cases").select("*", { count: "exact", head: true }).eq("archived", false).is("closed_at", null),
    getUserId().then((uid) =>
      supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assignee_id", uid ?? "00000000-0000-0000-0000-000000000000")
        .in("status", ["todo", "in_progress"]),
    ),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("starts_at", madridToUtc(todayMadrid(), "00:00").toISOString())
      .lt("starts_at", madridToUtc(addDays(todayMadrid(), 1), "00:00").toISOString()),
  ]);

  const cards = [
    { label: "Contactos", value: contactsError ? null : (contacts ?? 0), href: "/contacts" },
    { label: "Expedientes abiertos", value: openCases.error ? null : (openCases.count ?? 0), href: "/cases" },
    { label: "Mis tareas pendientes", value: myTasks.error ? null : (myTasks.count ?? 0), href: "/tasks" },
    { label: "Citas de hoy", value: todayAppts.error ? null : (todayAppts.count ?? 0), href: "/calendar" },
    { label: "Miembros del equipo", value: members ?? 0, href: "/settings" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Panel</h1>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Link href={c.href} className="block rounded-lg border border-zinc-200 p-4 hover:border-brand">
              <p className="text-sm text-zinc-500">{c.label}</p>
              <p className="mt-1 text-3xl font-semibold">{c.value ?? "—"}</p>
              {c.value === null && <p className="mt-1 text-xs text-zinc-500">No disponible</p>}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Gestiona tu equipo en{" "}
        <Link href="/settings" className="underline">
          Ajustes
        </Link>
        .
      </p>
    </div>
  );
}
