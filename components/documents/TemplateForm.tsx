"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveTemplate } from "@/lib/modules/documents/actions";
import { CONTEXT_LABELS, type TemplateContextKind } from "@/lib/modules/documents/variables";
import type { DocFormState, Template } from "@/lib/modules/documents/types";
import { TemplateEditor } from "./TemplateEditor";

export function TemplateForm({ template }: { template?: Template }) {
  const [state, formAction, pending] = useActionState<DocFormState, FormData>(saveTemplate.bind(null, template?.id ?? null), undefined);
  const [context, setContext] = useState<TemplateContextKind>(template?.context ?? "general");
  const ps = template?.page_settings ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && <p role="alert" className="alert-error">{state.error}</p>}

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          Nombre de la plantilla *
          <input name="name" required defaultValue={template?.name ?? ""} className="input" placeholder="Ej.: Presupuesto de proyectos eléctricos" />
        </label>
        <label className="field sm:col-span-2">
          Descripción (opcional)
          <input name="description" defaultValue={template?.description ?? ""} className="input" />
        </label>
        <label className="field">
          ¿Para qué se usa?
          <select name="context" value={context} onChange={(e) => setContext(e.target.value as TemplateContextKind)} className="input">
            {Object.entries(CONTEXT_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="is_default" defaultChecked={template?.is_default} />
          Usar como plantilla predeterminada para este uso
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Contenido</h2>
        <TemplateEditor name="body" initialHtml={template?.body ?? "<p></p>"} context={context} />
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="section-title sm:col-span-2 lg:col-span-4">Página</h2>
        <label className="field">
          Orientación
          <select name="orientation" defaultValue={ps.orientation ?? "portrait"} className="input">
            <option value="portrait">Vertical</option>
            <option value="landscape">Horizontal</option>
          </select>
        </label>
        <label className="field">
          Márgenes (mm)
          <input name="margin_mm" type="number" min={10} max={40} defaultValue={ps.margin_mm ?? 20} className="input" />
        </label>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="header_logo" defaultChecked={ps.header_logo ?? true} /> Logotipo en la cabecera
        </label>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="page_numbers" defaultChecked={ps.page_numbers ?? true} /> Numerar las páginas
        </label>
        <label className="field sm:col-span-2 lg:col-span-4">
          Pie de página (opcional; si lo dejas vacío se usa el de «Identidad de la empresa»)
          <input name="footer_text" defaultValue={ps.footer_text ?? ""} maxLength={300} className="input" />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : "Guardar plantilla"}</button>
        {template && (
          <a href={`/settings/templates/${template.id}/preview`} target="_blank" rel="noreferrer" className="btn btn-secondary">Vista previa en PDF</a>
        )}
        <Link href="/settings/templates" className="link text-sm">Cancelar</Link>
      </div>
      {template && <p className="text-xs text-muted">La vista previa usa la última versión guardada y datos de ejemplo.</p>}
    </form>
  );
}
