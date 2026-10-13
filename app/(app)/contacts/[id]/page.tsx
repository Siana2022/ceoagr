import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContact } from "@/lib/modules/contacts/queries";
import { archiveContact, restoreContact } from "@/lib/modules/contacts/actions";
import { CONTACT_KIND_LABELS } from "@/lib/modules/contacts/types";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";

const FUTURE_TABS = ["Expedientes", "Tareas", "Agenda", "Documentos", "Comunicaciones", "Tiempo"];

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, role] = await Promise.all([getContact(id), getCurrentRole()]);
  if (!found) notFound();
  const { contact: c, ownerName } = found;
  const writable = role ? canWrite(role) : false;

  const addr = [c.address.street, c.address.postal_code, c.address.city, c.address.province, c.address.country]
    .filter(Boolean)
    .join(", ");

  const rows: [string, string | null][] = [
    ["Tipo", CONTACT_KIND_LABELS[c.kind]],
    ["Razón social", c.legal_name],
    ["NIF / CIF", c.tax_id],
    ["Email", c.email],
    ["Teléfono", c.phone],
    ["Móvil", c.mobile],
    ["Dirección", addr || null],
    ["Origen", c.source],
    ["Responsable", ownerName],
    ["Alta", new Date(c.created_at).toLocaleDateString("es-ES")],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/contacts" className="text-sm underline">← Contactos</Link>
          <h1 className="mt-1 text-xl font-semibold">
            {c.name}
            {c.archived && <span className="ml-2 text-sm font-normal text-zinc-500">(archivado)</span>}
          </h1>
        </div>
        {writable && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/contacts/${c.id}/edit`} className="underline">Editar</Link>
            {c.archived ? (
              <form action={restoreContact.bind(null, c.id)}>
                <button type="submit" className="underline">Restaurar</button>
              </form>
            ) : (
              <form action={archiveContact.bind(null, c.id)}>
                <button type="submit" className="underline">Archivar</button>
              </form>
            )}
          </div>
        )}
      </div>

      <nav aria-label="Secciones del contacto" className="flex flex-wrap gap-2 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <span aria-current="page" className="border-b-2 border-zinc-900 px-3 py-2 font-medium dark:border-zinc-50">Resumen</span>
        {FUTURE_TABS.map((t) => (
          <span key={t} aria-disabled="true" className="px-3 py-2 text-zinc-400 dark:text-zinc-600">{t}</span>
        ))}
      </nav>

      <dl className="grid max-w-2xl grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd>{v || "—"}</dd>
          </div>
        ))}
        <dt className="text-zinc-500">Etiquetas</dt>
        <dd>{c.tags.length ? c.tags.join(", ") : "—"}</dd>
      </dl>
    </div>
  );
}
