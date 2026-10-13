import { describe, expect, it } from "vitest";
import { generatePassword } from "@/lib/modules/team/password";
import { memberSchema, newPasswordSchema } from "@/lib/modules/team/schema";

describe("generatePassword", () => {
  it("has the requested length and no ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).not.toMatch(/[0OIl1]/);
    }
  });
  it("is not constant", () => {
    expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBeGreaterThan(15);
  });
});

describe("member schema", () => {
  const ok = { full_name: " Ana ", email: "ANA@Empresa.com", role: "member", password: "" };
  it("normalizes email, trims name and treats empty password as generated", () => {
    const r = memberSchema.safeParse(ok);
    expect(r.success && [r.data.full_name, r.data.email, r.data.password]).toEqual(["Ana", "ana@empresa.com", null]);
  });
  it("never allows creating an owner", () => {
    expect(memberSchema.safeParse({ ...ok, role: "owner" }).success).toBe(false);
  });
  it("rejects short explicit passwords and bad emails", () => {
    expect(memberSchema.safeParse({ ...ok, password: "abc" }).success).toBe(false);
    expect(memberSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
  });
});

describe("new password schema", () => {
  it("requires matching confirmation", () => {
    expect(newPasswordSchema.safeParse({ password: "12345678", confirm: "12345679" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "12345678", confirm: "12345678" }).success).toBe(true);
  });
});
