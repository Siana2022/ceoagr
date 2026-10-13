import { PRIORITY_LABELS } from "@/lib/modules/cases/types";
import { ASSIGN_LABELS } from "@/lib/modules/task-templates/schema";
import type { PipelineStatus } from "@/lib/modules/cases/types";
import type { TaskTemplate } from "@/lib/modules/task-templates/queries";

// Shared by the "add" and "edit" forms (server-rendered, no client JS needed).
export function TaskTemplateFields({
  pipeline,
  template,
  fixedStatus,
}: {
  pipeline: PipelineStatus[];
  template?: TaskTemplate;
  fixedStatus?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fixedStatus ? (
        <input type="hidden" name="status_key" value={fixedStatus} />
      ) : (
        <label className="field">
          Fase *
          <select name="status_key" defaultValue={template?.status_key ?? pipeline[0]?.key} className="input">
            {pipeline.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
          </select>
        </label>
      )}
      <label className="field sm:col-span-2">
        Título de la tarea *
        <input name="title" required defaultValue={template?.title ?? ""} className="input" placeholder="Ej.: Visita técnica a la instalación" />
      </label>
      <label className="field sm:col-span-2">
        Descripción
        <textarea name="description" rows={2} defaultValue={template?.description ?? ""} className="input" />
      </label>
      <label className="field">
        Asignar a
        <select name="assign_to" defaultValue={template?.assign_to ?? "owner"} className="input">
          {Object.entries(ASSIGN_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
        </select>
      </label>
      <label className="field">
        Plazo (días desde el cambio de fase)
        <input name="due_offset_days" type="number" min={0} max={3650} defaultValue={template?.due_offset_days ?? ""} className="input" placeholder="Sin plazo" />
      </label>
      <label className="field">
        Prioridad
        <select name="priority" defaultValue={template?.priority ?? "normal"} className="input">
          {Object.entries(PRIORITY_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
        </select>
      </label>
      <label className="field sm:col-span-2">
        Checklist (un elemento por línea)
        <textarea name="checklist" rows={4} defaultValue={template?.checklist.join("\n") ?? ""} className="input" placeholder={"Fotos del estado actual\nMediciones\nInforme preliminar"} />
      </label>
      {template && (
        <>
          <input type="hidden" name="active_present" value="1" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={template.active} /> Activa
          </label>
        </>
      )}
    </div>
  );
}
