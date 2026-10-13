import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { getDocument } from "@/lib/modules/documents/queries";
import { archiveDocument, restoreDocument, uploadNewVersion } from "@/lib/modules/documents/actions";
import { formatBytes } from "@/lib/modules/documents/types";
import { fmtDateTime } from "@/lib/modules/format";
import { UploadForm } from "@/components/documents/UploadForm";

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, role] = await Promise.all([getDocument(id), getCurrentRole()]);
  if (!found) notFound();
  const { doc, kase, contact, previous, newer, previewUrl } = found;
  const writable = !!role && canWrite(role);

  const rows: [string, React.ReactNode][] = [
    ["Versión", `v${doc.version}`],
    ["Tipo", doc.mime_type ?? "—"],
    ["Tamaño", formatBytes(doc.size_bytes)],
    ["Subido", fmtDateTime(doc.created_at)],
    ["Etiquetas", doc.tags.join(", ") || "—"],
    ["Expediente", kase ? <Link key="k" href={`/cases/${kase.id}`} className="text-brand underline">{kase.code}</Link> : "—"],
    ["Contacto", contact ? <Link key="c" href={`/contacts/${contact.id}`} className="text-brand underline">{contact.name}</Link> : "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/documents" className="text-sm underline">← Documentos</Link>
        <h1 className="mt-1 text-xl font-semibold">
          {doc.name}
          {doc.archived && <span className="ml-2 text-sm font-normal text-zinc-500">(archivado)</span>}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <a href={`/documents/${doc.id}/download`} className="rounded-[5px] bg-brand px-4 py-2 font-semibold uppercase tracking-wide text-white hover:bg-brand-dark">
          Descargar
        </a>
        {writable && (doc.archived ? (
          <form action={restoreDocument.bind(null, id)}><button type="submit" className="underline">Restaurar</button></form>
        ) : (
          <form action={archiveDocument.bind(null, id)}><button type="submit" className="underline">Archivar</button></form>
        ))}
      </div>

      {newer && (
        <p className="text-sm text-amber-700">
          Hay una versión más reciente: <Link href={`/documents/${newer.id}`} className="underline">v{newer.version}</Link>.
        </p>
      )}

      <dl className="grid max-w-2xl grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {previous && (
          <div className="contents">
            <dt className="text-zinc-500">Versión anterior</dt>
            <dd><Link href={`/documents/${previous.id}`} className="text-brand underline">v{previous.version}</Link></dd>
          </div>
        )}
      </dl>

      {previewUrl && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Vista previa</h2>
          {doc.mime_type?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={doc.name} className="max-h-[32rem] max-w-full rounded-[5px] border border-zinc-200 object-contain" />
          ) : (
            <iframe src={previewUrl} title={doc.name} className="h-[40rem] w-full rounded-[5px] border border-zinc-200" />
          )}
        </section>
      )}

      {writable && !newer && !doc.archived && (
        <section className="flex flex-col gap-2 border-t border-zinc-200 pt-4">
          <h2 className="text-lg font-semibold">Subir nueva versión</h2>
          <UploadForm action={uploadNewVersion.bind(null, id)} withTags={false} label="Subir versión" />
        </section>
      )}
    </div>
  );
}
