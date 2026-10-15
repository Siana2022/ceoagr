import { describe, expect, it } from "vitest";
import { changesOf, displayName, entityHref, summarize } from "@/lib/modules/audit/summary";

describe("audit summaries", () => {
  it("lists visible changes, hides noise and truncates", () => {
    const diff = { status: { old: "nuevo", new: "en_curso" }, updated_at: { old: "a", new: "b" }, search: { old: 1, new: 2 }, title: { old: "A", new: "B".repeat(60) } };
    const ch = changesOf(diff);
    expect(ch.map((c) => c.field)).toEqual(["estado", "título"]);
    expect(ch[1].after.length).toBeLessThanOrEqual(40);
    expect(ch[1].after.endsWith("…")).toBe(true);
  });
  it("names inserts/deletes from the row and updates from the new value", () => {
    expect(displayName({ name: "Ana", id: "1" })).toBe("Ana");
    expect(displayName({ code: "PRJ-1" })).toBe("PRJ-1");
    expect(displayName({ title: { old: "x", new: "Nuevo título" } })).toBe("Nuevo título");
    expect(displayName({ id: "1" })).toBeNull();
  });
  it("summarizes by action", () => {
    expect(summarize("insert", { name: "Ana" }).headline).toBe("Ana");
    expect(summarize("update", { stage: { old: "lead", new: "won" } }).changes[0]).toEqual({ field: "fase", before: "lead", after: "won" });
    expect(summarize("update", { updated_at: { old: 1, new: 2 } }).headline).toBe("Sin cambios visibles");
    expect(summarize("merge", { merged_name: "Dup SL" }).headline).toContain("Dup SL");
  });
  it("caps visible changes", () => {
    const diff = Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((k) => [k, { old: 1, new: 2 }]));
    const s = summarize("update", diff);
    expect(s.changes).toHaveLength(4);
    expect(s.more).toBe(2);
  });
  it("links known entities only", () => {
    expect(entityHref("cases", "abc")).toBe("/cases/abc");
    expect(entityHref("clock_events", "abc")).toBeNull();
  });
});
