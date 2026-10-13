"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass, inputClass } from "@/components/form-styles";
import {
  FIELD_TYPE_LABELS,
  type CaseFormState,
  type CaseType,
  type FieldType,
  type PipelineStatus,
  type SchemaField,
} from "@/lib/modules/cases/types";

type Props = {
  action: (prev: CaseFormState, fd: FormData) => Promise<CaseFormState>;
  type?: CaseType;
  submitLabel: string;
};

const DEFAULT_PIPELINE: PipelineStatus[] = [
  { key: "nuevo", label: "Nuevo", color: "#64748b", initial: true },
  { key: "en_curso", label: "En curso", color: "#0369a1" },
  { key: "cerrado", label: "Cerrado", color: "#15803d", final: true },
];

const smallBtn = "btn btn-secondary btn-sm";

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export function CaseTypeForm({ action, type, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.values ?? {};
  const errors = state?.fieldErrors ?? {};

  const [fields, setFields] = useState<SchemaField[]>(type?.custom_schema ?? []);
  const [pipeline, setPipeline] = useState<PipelineStatus[]>(type?.pipeline ?? DEFAULT_PIPELINE);

  const patchField = (i: number, p: Partial<SchemaField>) =>
    setFields((f) => f.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const patchStatus = (i: number, p: Partial<PipelineStatus>) =>
    setPipeline((s) => s.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const text = (name: string, label: string, def: string) => (
    <label className="field">
      {label} *
      <input
        name={name}
        required
        defaultValue={values[name] ?? def}
        aria-invalid={errors[name] ? true : undefined}
        className={inputClass}
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </label>
  );

  return (
    <form action={formAction} className="card flex max-w-3xl flex-col gap-8 p-6">
      {state?.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {text("name", "Nombre del tipo", type?.name ?? "")}
        {text("code_prefix", "Prefijo del código (ej. EXP)", type?.code_prefix ?? "EXP")}
        {text("label_singular", "Se llama (singular)", type?.label_singular ?? "Expediente")}
        {text("label_plural", "Se llama (plural)", type?.label_plural ?? "Expedientes")}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Estados</h2>
        <p className="text-sm text-muted">
          El orden es el del flujo. Marca cuál es el inicial y cuáles cierran el expediente.
        </p>
        {pipeline.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Nombre del estado"
              value={s.label}
              onChange={(e) => patchStatus(i, { label: e.target.value })}
              className={`${inputClass} w-48`}
            />
            <input
              type="color"
              aria-label="Color"
              value={s.color}
              onChange={(e) => patchStatus(i, { color: e.target.value })}
              className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="initial_radio"
                checked={!!s.initial}
                onChange={() =>
                  setPipeline((p) => p.map((x, k) => ({ ...x, initial: k === i })))
                }
              />
              Inicial
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={!!s.final}
                onChange={(e) => patchStatus(i, { final: e.target.checked })}
              />
              Cierra
            </label>
            <button type="button" className={smallBtn} onClick={() => setPipeline((p) => move(p, i, -1))} aria-label="Subir">↑</button>
            <button type="button" className={smallBtn} onClick={() => setPipeline((p) => move(p, i, 1))} aria-label="Bajar">↓</button>
            <button
              type="button"
              className={smallBtn}
              disabled={pipeline.length <= 1}
              onClick={() => setPipeline((p) => p.filter((_, k) => k !== i))}
            >
              Quitar
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className={smallBtn}
            onClick={() => setPipeline((p) => [...p, { key: "", label: "", color: "#64748b" }])}
          >
            + Añadir estado
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Campos personalizados</h2>
        <p className="text-sm text-muted">Datos extra que se piden al crear cada expediente de este tipo.</p>
        {fields.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Nombre del campo"
              value={f.label}
              onChange={(e) => patchField(i, { label: e.target.value })}
              className={`${inputClass} w-48`}
            />
            <select
              aria-label="Tipo de campo"
              value={f.type}
              onChange={(e) => patchField(i, { type: e.target.value as FieldType })}
              className={`${inputClass} w-44`}
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {f.type === "select" && (
              <input
                aria-label="Opciones"
                placeholder="Opciones, separadas por comas"
                value={(f.options ?? []).join(", ")}
                onChange={(e) =>
                  patchField(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })
                }
                className={`${inputClass} w-64`}
              />
            )}
            {f.type !== "boolean" && (
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={(e) => patchField(i, { required: e.target.checked })}
                />
                Obligatorio
              </label>
            )}
            <button type="button" className={smallBtn} onClick={() => setFields((p) => move(p, i, -1))} aria-label="Subir">↑</button>
            <button type="button" className={smallBtn} onClick={() => setFields((p) => move(p, i, 1))} aria-label="Bajar">↓</button>
            <button type="button" className={smallBtn} onClick={() => setFields((p) => p.filter((_, k) => k !== i))}>Quitar</button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className={smallBtn}
            onClick={() => setFields((p) => [...p, { key: "", label: "", type: "text" }])}
          >
            + Añadir campo
          </button>
        </div>
      </section>

      <input type="hidden" name="fields_json" value={JSON.stringify(fields)} />
      <input type="hidden" name="pipeline_json" value={JSON.stringify(pipeline)} />

      <div className="flex items-center gap-4">
        <div className="w-44">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Guardando…" : submitLabel}
          </button>
        </div>
        <Link href="/settings/case-types" className="link text-sm">Cancelar</Link>
      </div>
    </form>
  );
}
