import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { count: members } = await supabase
    .from("memberships")
    .select("*", { count: "exact", head: true });

  const cards = [
    { label: "Miembros del equipo", value: members ?? 0 },
    { label: "Contactos", value: null },
    { label: "Expedientes abiertos", value: null },
    { label: "Tareas pendientes", value: null },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Panel</h1>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li
            key={c.label}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold">{c.value ?? "—"}</p>
            {c.value === null && (
              <p className="mt-1 text-xs text-zinc-500">Disponible pronto</p>
            )}
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
