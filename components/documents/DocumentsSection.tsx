import Link from "next/link";
import { fmtDate } from "@/lib/modules/format";
import { listDocuments } from "@/lib/modules/documents/queries";
import { listTemplates } from "@/lib/modules/documents/queries";
import { generateFromTemplate, uploadDocument } from "@/lib/modules/documents/actions";
import { formatBytes } from "@/lib/modules/documents/types";
import { UploadForm } from "./UploadForm";
import { inputClass } from "@/components/form-styles";

type Props = { caseId?: string; contactId?: string; back: string; canWrite: boolean };

// Documents block for case and contact sheets.
export async function DocumentsSection({ caseId, contactId, back, canWrite }: Props) {
  const [{ rows, error }, templates] = await Promise.all([
    listDocuments({ caseId, contactId, limit: 50 }),
    canWrite ? listTemplates() : Promise.resolve([]),
  ]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Documentos</h2>
      {error && <p role="alert" className="text-sm text-red-600">No se pudieron cargar los documentos.</p>}
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
            <Link href={`/documents/${d.id}`} className="font-medium text-brand underline">
              {d.name}
            </Link>
            <span className="text-zinc-500">
              v{d.version} · {formatBytes(d.size_bytes)} · {fmtDate(d.created_at)}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-zinc-500">Sin documentos.</li>}
      </ul>

      {canWrite && (
        <>
          <UploadForm action={uploadDocument} caseId={caseId} contactId={contactId} back={back} />
          {templates.length > 0 && (
            <form action={generateFromTemplate} className="flex flex-wrap items-end gap-2">
              {caseId && <input type="hidden" name="case_id" value={caseId} />}
              {contactId && <input type="hidden" name="contact_id" value={contactId} />}
              <input type="hidden" name="back" value={back} />
              <label className="flex flex-col gap-1 text-sm">
                Generar desde plantilla
                <select name="template_id" required className={`${inputClass} h-10 w-64`}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-10 rounded-[5px] bg-brand px-4 text-sm font-semibold uppercase tracking-wide text-white hover:bg-brand-dark"
              >
                Generar
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
