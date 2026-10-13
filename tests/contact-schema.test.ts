import { describe, expect, it } from "vitest";
import { buildContactSchema, formToInput } from "@/lib/modules/contacts/schema";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("contact schema", () => {
  it("accepts only kind and name; empty optionals become null", () => {
    const r = buildContactSchema([]).safeParse(
      formToInput(form({ kind: "person", name: "  Ana  ", email: "" })),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Ana");
      expect(r.data.email).toBeNull();
      expect(r.data.tags).toEqual([]);
    }
  });

  it("rejects missing name and invalid kind", () => {
    const r = buildContactSchema([]).safeParse(formToInput(form({ kind: "x", name: "" })));
    expect(r.success).toBe(false);
  });

  it("rejects malformed email", () => {
    const r = buildContactSchema([]).safeParse(
      formToInput(form({ kind: "person", name: "Ana", email: "no-es-email" })),
    );
    expect(r.success).toBe(false);
  });

  it("enforces organization-configured required fields", () => {
    const r = buildContactSchema(["email", "tax_id"]).safeParse(
      formToInput(form({ kind: "company", name: "ACME", email: "a@b.com" })),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join("_"))).toEqual(["tax_id"]);
    }
  });

  it("splits and trims tags", () => {
    const r = buildContactSchema([]).safeParse(
      formToInput(form({ kind: "person", name: "Ana", tags: " vip, , lead ,nuevo" })),
    );
    expect(r.success && r.data.tags).toEqual(["vip", "lead", "nuevo"]);
  });
});
