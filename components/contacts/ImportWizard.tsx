"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmImport, previewImport } from "@/lib/modules/contacts/import";
import type { ImportState } from "@/lib/modules/contacts/types";

const BADGE = {
  ok: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
  duplicate: "bg-amber-100 text-amber-700",
} as const;
const LABEL = { ok: "Válido", error: "Error", duplicate: "Duplicado" } as const;

export function ImportWizard() {
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(previewImport, undefined);
  const [done, confirmAction, importing] = useActionState<ImportState, FormData>(confirmImport, undefined);
  const p = preview?.preview;

  if (done?.result && !done.error) {
    return (
      <div className="card flex max-w-2xl flex-col gap-4 p-6">
        <p role="status" className="alert-ok">
          Importación terminada: <strong>{done.result.inserted}</strong> contactos creados
          {done.result.skipped > 0 && <> y {done.result.skipped} omitidos</>}.
        </p>
        <div className="flex gap-3">
          <Link href="/contacts" className="btn btn-primary">Ver contactos</Link>
          <Link href="/contacts/duplicates" className="btn btn-secondary">Revisar duplicados</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={previewAction} className="card flex max-w-2xl flex-col gap-4 p-6">
        <h2 className="section-title">1. Sube tu archivo CSV</h2>
        <p className="text-sm text-muted">
          Columnas reconocidas: Tipo, Nombre, Razón social, NIF/CIF, Email, Teléfono, Móvil, Calle, CP, Ciudad, Provincia, País,
          Etiquetas (separadas por |) y Origen. El orden da igual y los nombres admiten variantes habituales.{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page */}
          <a href="/contacts/import/template" className="link">Descargar plantilla</a>
        </p>
        {preview?.error && <p role="alert" className="alert-error">{preview.error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
          <button type="submit" disabled={previewing} className="btn btn-secondary">{previewing ? "Analizando…" : "Analizar archivo"}</button>
        </div>
      </form>

      {p && (
        <form action={confirmAction} className="card flex flex-col gap-4 p-6">
          <h2 className="section-title">2. Revisa y confirma</h2>
          <ul className="flex flex-wrap gap-4 text-sm">
            <li><strong>{p.total}</strong> filas</li>
            <li className="text-emerald-700"><strong>{p.valid}</strong> listas para importar</li>
            <li className="text-amber-700"><strong>{p.duplicates}</strong> posibles duplicados</li>
            <li className="text-danger"><strong>{p.invalid}</strong> con errores (no se importarán)</li>
          </ul>
          {p.unknownColumns.length > 0 && (
            <p className="text-xs text-muted">Columnas ignoradas: {p.unknownColumns.join(", ")}</p>
          )}
          {done?.error && <p role="alert" className="alert-error">{done.error}</p>}

          <div className="table-card !shadow-none">
            <table>
              <thead><tr><th>Línea</th><th>Nombre</th><th>Email</th><th>NIF/CIF</th><th>Estado</th><th>Detalle</th></tr></thead>
              <tbody>
                {p.rows.slice(0, 50).map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td><td>{r.name || "—"}</td><td>{r.email || "—"}</td><td>{r.tax_id || "—"}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{LABEL[r.status]}</span></td>
                    <td className="text-xs text-muted">{r.messages.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.rows.length > 50 && <p className="text-xs text-muted">Se muestran las primeras 50 filas de {p.rows.length}.</p>}

          <input type="hidden" name="payload" value={p.payload} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="skip_duplicates" defaultChecked /> Omitir los que ya existen (mismo email, NIF o teléfono)
          </label>
          <div>
            <button type="submit" disabled={importing || p.valid + p.duplicates === 0} className="btn btn-primary">
              {importing ? "Importando…" : "Importar contactos"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
