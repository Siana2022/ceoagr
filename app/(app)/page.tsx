import Link from "next/link";
import { Briefcase, CalendarDays, CheckSquare, Users, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserId, listTasks } from "@/lib/modules/tasks/queries";
import { listAppointments } from "@/lib/modules/agenda/queries";
import { addDays, fmtDate, madridParts, madridToUtc, todayMadrid } from "@/lib/modules/format";
import { PRIORITY_LABELS, type Priority } from "@/lib/modules/cases/types";

type Card = { label: string; value: number | null; href: string; icon: LucideIcon; tone: string };

export default async function HomePage() {
  const supabase = await createClient();
  const today = todayMadrid();
  const dayStart = madridToUtc(today, "00:00").toISOString();
  const dayEnd = madridToUtc(addDays(today, 1), "00:00").toISOString();
  const uid = await getUserId();

  const [contacts, openCases, myTasks, todayAppts, profile, upcoming, agenda] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("archived", false),
    supabase.from("cases").select("*", { count: "exact", head: true }).eq("archived", false).is("closed_at", null),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assignee_id", uid ?? "00000000-0000-0000-0000-000000000000")
      .in("status", ["todo", "in_progress"]),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd),
    uid ? supabase.from("profiles").select("full_name").eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null }),
    listTasks({ scope: "mine", state: "open", limit: 6 }),
    listAppointments(dayStart, dayEnd),
  ]);

  const num = (r: { count: number | null; error: unknown }) => (r.error ? null : (r.count ?? 0));
  const cards: Card[] = [
    { label: "Contactos", value: num(contacts), href: "/contacts", icon: Users, tone: "bg-blue-50 text-blue-700" },
    { label: "Expedientes abiertos", value: num(openCases), href: "/cases", icon: Briefcase, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Mis tareas pendientes", value: num(myTasks), href: "/tasks", icon: CheckSquare, tone: "bg-amber-50 text-amber-700" },
    { label: "Citas de hoy", value: num(todayAppts), href: "/calendar", icon: CalendarDays, tone: "bg-emerald-50 text-emerald-700" },
  ];

  const firstName = (profile.data?.full_name ?? "").split(" ")[0];
  const todayLabel = new Date(`${today}T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", dateStyle: "full" });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="page-title">{firstName ? `Hola, ${firstName}` : "Panel"}</h1>
        <p className="page-sub capitalize">{todayLabel}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, href, icon: Icon, tone }) => (
          <li key={label}>
            <Link href={href} className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={22} />
              </span>
              <span>
                <span className="block text-3xl font-bold leading-none tracking-tight">{value ?? "—"}</span>
                <span className="mt-1 block text-sm text-muted">{label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Mis próximas tareas</h2>
            <Link href="/tasks" className="link text-sm">Ver todas</Link>
          </div>
          <ul className="flex flex-col divide-y divide-slate-100">
            {upcoming.rows.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <Link href={`/tasks/${t.id}`} className="link truncate">{t.title}</Link>
                <span className="shrink-0 text-xs text-muted">
                  {PRIORITY_LABELS[t.priority as Priority]} · {fmtDate(t.due_at)}
                </span>
              </li>
            ))}
            {upcoming.rows.length === 0 && (
              <li className="py-6 text-center text-sm text-muted">No tienes tareas pendientes. 🎉</li>
            )}
          </ul>
        </section>

        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Agenda de hoy</h2>
            <Link href="/calendar" className="link text-sm">Abrir agenda</Link>
          </div>
          <ul className="flex flex-col divide-y divide-slate-100">
            {agenda.rows
              .filter((a) => a.status !== "cancelled")
              .map((a) => (
                <li key={a.id} className="flex items-center gap-4 py-3 text-sm">
                  <span className="w-14 shrink-0 font-semibold tabular-nums">{madridParts(a.starts_at).time}</span>
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: a.resources?.color ?? "#003366" }}
                    aria-hidden="true"
                  />
                  <Link href={`/calendar/${a.id}`} className="min-w-0 flex-1">
                    <span className="link block truncate">{a.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {a.resources?.name}
                      {a.contacts?.name ? ` · ${a.contacts.name}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            {agenda.rows.filter((a) => a.status !== "cancelled").length === 0 && (
              <li className="py-6 text-center text-sm text-muted">No hay citas para hoy.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
