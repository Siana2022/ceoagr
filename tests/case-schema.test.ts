import { describe, expect, it } from "vitest";
import { parseCustomFields, parseFields, parsePipeline, caseSchema } from "@/lib/modules/cases/schema";
import type { SchemaField } from "@/lib/modules/cases/types";

describe("pipeline", () => {
  it("derives unique keys and defaults the first status as initial", () => {
    const r = parsePipeline(
      JSON.stringify([
        { label: "En curso", color: "#112233" },
        { label: "En curso", color: "#112233" },
        { label: "Cerrado", color: "#112233", final: true },
      ]),
    );
    expect(r.pipeline?.map((s) => s.key)).toEqual(["en_curso", "en_curso_2", "cerrado"]);
    expect(r.pipeline?.[0].initial).toBe(true);
    expect(r.pipeline?.[2].final).toBe(true);
  });

  it("rejects empty pipelines, bad colors and several initial states", () => {
    expect(parsePipeline("[]").error).toBeTruthy();
    expect(parsePipeline(JSON.stringify([{ label: "A", color: "rojo" }])).error).toBeTruthy();
    expect(
      parsePipeline(
        JSON.stringify([
          { label: "A", color: "#000000", initial: true },
          { label: "B", color: "#000000", initial: true },
        ]),
      ).error,
    ).toBeTruthy();
  });
});

describe("custom schema fields", () => {
  it("requires options for select fields", () => {
    expect(parseFields(JSON.stringify([{ label: "Zona", type: "select" }])).error).toBeTruthy();
    expect(
      parseFields(JSON.stringify([{ label: "Zona", type: "select", options: ["N", "S"] }])).fields?.[0].key,
    ).toBe("zona");
  });
});

describe("custom field values", () => {
  const fields: SchemaField[] = [
    { key: "superficie", label: "Superficie", type: "number", required: true },
    { key: "zona", label: "Zona", type: "select", options: ["N", "S"] },
    { key: "urgente", label: "Urgente", type: "boolean" },
    { key: "visita", label: "Visita", type: "date" },
  ];
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };

  it("parses typed values", () => {
    const r = parseCustomFields(
      fd({ cf_superficie: "120.5", cf_zona: "N", cf_urgente: "on", cf_visita: "2026-11-02" }),
      fields,
    );
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({ superficie: 120.5, zona: "N", urgente: true, visita: "2026-11-02" });
  });

  it("flags required, invalid option and invalid number", () => {
    expect(parseCustomFields(fd({ cf_superficie: "" }), fields).errors.cf_superficie).toMatch(/obligatorio/);
    expect(parseCustomFields(fd({ cf_superficie: "1", cf_zona: "X" }), fields).errors.cf_zona).toBeTruthy();
    expect(parseCustomFields(fd({ cf_superficie: "abc" }), fields).errors.cf_superficie).toBeTruthy();
  });
});

describe("case base schema", () => {
  const ok = { contact_id: "00000000-0000-4000-8000-000000000001", title: "T", priority: "normal", due_at: "", budget_hours: "", owner_id: "" };
  it("accepts minimal input", () => {
    const r = caseSchema.safeParse(ok);
    expect(r.success && r.data.due_at).toBeNull();
  });
  it("rejects bad contact and negative hours", () => {
    expect(caseSchema.safeParse({ ...ok, contact_id: "x" }).success).toBe(false);
    expect(caseSchema.safeParse({ ...ok, budget_hours: "-1" }).success).toBe(false);
  });
});
