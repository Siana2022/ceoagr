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
    ["Expediente", kase ? <Link key="k" href={`/cases/${kase.id}`} className="link">{kase.code}</Link> : "—"],
    ["Contacto", contact ? <Link key="c" href={`/contacts/${contact.id}`} className="link">{contact.name}</Link> : "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/documents" className="link text-sm">← Documentos</Link>
        <h1 className="page-title mt-1">
          {doc.name}
          {doc.archived && <span className="ml-2 text-sm font-normal text-muted">(archivado)</span>}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <a href={`/documents/${doc.id}/download`} className="btn btn-primary">
          Descargar
        </a>
        {writable && (doc.archived ? (
          <form action={restoreDocument.bind(null, id)}><button type="submit" className="link">Restaurar</button></form>
        ) : (
          <form action={archiveDocument.bind(null, id)}><button type="submit" className="link">Archivar</button></form>
        ))}
      </div>

      {newer && (
        <p className="alert-error">
          Hay una versión más reciente: <Link href={`/documents/${newer.id}`} className="link">v{newer.version}</Link>.
        </p>
      )}

      <dl className="dl-grid card max-w-2xl p-6">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {previous && (
          <div className="contents">
            <dt className="text-muted">Versión anterior</dt>
            <dd><Link href={`/documents/${previous.id}`} className="link">v{previous.version}</Link></dd>
          </div>
        )}
      </dl>

      {previewUrl && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">Vista previa</h2>
          {doc.mime_type?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={doc.name} className="max-h-[32rem] max-w-full rounded-xl border border-line object-contain" />
          ) : (
            <iframe src={previewUrl} title={doc.name} className="h-[40rem] w-full rounded-xl border border-line" />
          )}
        </section>
      )}

      {writable && !newer && !doc.archived && (
        <section className="card flex flex-col gap-2 p-6">
          <h2 className="section-title">Subir nueva versión</h2>
          <UploadForm action={uploadNewVersion.bind(null, id)} withTags={false} label="Subir versión" />
        </section>
      )}
    </div>
  );
}
