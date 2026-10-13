// Integration test against the real Supabase project.
// Runs only with RUN_RLS_TESTS=1 and SUPABASE_SERVICE_ROLE_KEY set in .env.local.
// Creates two throwaway users/organizations and deletes them afterwards.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = process.env.RUN_RLS_TESTS === "1" && !!service;

describe.skipIf(!enabled)("cross-organization isolation (RLS)", () => {
  const stamp = Date.now();
  const password = `Tmp-${stamp}-pass!`;
  const admin = enabled ? createClient(url, service!, { auth: { persistSession: false } }) : null!;
  const users: { id: string; email: string; client: SupabaseClient; orgId?: string }[] = [];

  async function makeUser(label: string) {
    const email = `rls-${label}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const { data: orgId, error: orgError } = await client.rpc("create_organization", {
      p_name: `Org ${label}`,
      p_slug: `rls-${label}-${stamp}`,
    });
    if (orgError) throw orgError;
    const u = { id: data.user.id, email, client, orgId: orgId as string };
    users.push(u);
    return u;
  }

  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  let contactId: string;
  let caseId: string;
  let resourceId: string;

  beforeAll(async () => {
    a = await makeUser("a");
    b = await makeUser("b");
    const { data, error } = await a.client
      .from("contacts")
      .insert({ kind: "person", name: "Contacto de A" })
      .select("id")
      .single();
    if (error) throw error;
    contactId = data.id;

    const type = await a.client
      .from("case_types")
      .insert({ name: "Tipo A", slug: "tipo-a", code_prefix: "TA" })
      .select("id")
      .single();
    if (type.error) throw type.error;
    const kase = await a.client
      .from("cases")
      .insert({ contact_id: contactId, case_type_id: type.data.id, title: "Caso de A" })
      .select("id")
      .single();
    if (kase.error) throw kase.error;
    caseId = kase.data.id;

    const task = await a.client.from("tasks").insert({ case_id: caseId, title: "Tarea de A" });
    if (task.error) throw task.error;
    const res = await a.client.from("resources").insert({ name: "Sala A" }).select("id").single();
    if (res.error) throw res.error;
    resourceId = res.data.id;
  });

  afterAll(async () => {
    for (const u of users) {
      await admin.from("organizations").delete().eq("id", u.orgId!);
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  it("owner A sees their contact", async () => {
    const { data } = await a.client.from("contacts").select("id");
    expect(data?.map((r) => r.id)).toContain(contactId);
  });

  it("B cannot read A's contacts", async () => {
    const { data } = await b.client.from("contacts").select("id");
    expect(data).toEqual([]);
  });

  it("B cannot update or delete A's contact", async () => {
    const upd = await b.client.from("contacts").update({ name: "hack" }).eq("id", contactId).select("id");
    expect(upd.data ?? []).toEqual([]);
    await b.client.from("contacts").delete().eq("id", contactId);
    const { data } = await a.client.from("contacts").select("name").eq("id", contactId).single();
    expect(data?.name).toBe("Contacto de A");
  });

  it("B cannot insert a contact into A's organization", async () => {
    const { error } = await b.client
      .from("contacts")
      .insert({ org_id: a.orgId, kind: "person", name: "intruso" });
    expect(error).not.toBeNull();
  });

  it("B cannot see A's organization, members or audit log", async () => {
    const orgs = await b.client.from("organizations").select("id");
    expect(orgs.data?.map((o) => o.id)).toEqual([b.orgId]);
    const members = await b.client.from("memberships").select("org_id");
    expect(members.data?.every((m) => m.org_id === b.orgId)).toBe(true);
    const audit = await b.client.from("audit_log").select("org_id");
    expect(audit.data?.every((r) => r.org_id === b.orgId)).toBe(true);
  });

  it("B cannot see A's cases, tasks, resources or case types", async () => {
    for (const table of ["cases", "tasks", "resources", "case_types", "case_events"]) {
      const { data } = await b.client.from(table).select("id");
      expect(data, table).toEqual([]);
    }
  });

  it("B cannot create records pointing at A's case, contact or resource", async () => {
    const t = await b.client.from("tasks").insert({ case_id: caseId, title: "intruso" });
    expect(t.error).not.toBeNull();
    const c = await b.client.from("cases").insert({ contact_id: contactId, case_type_id: caseId, title: "x" });
    expect(c.error).not.toBeNull();
    const ap = await b.client.from("appointments").insert({
      resource_id: resourceId,
      title: "intruso",
      starts_at: "2030-01-01T10:00:00Z",
      ends_at: "2030-01-01T11:00:00Z",
    });
    expect(ap.error).not.toBeNull();
  });

  it("an appointment cannot overlap another one on the same resource", async () => {
    const mk = (start: string, end: string) =>
      a.client.from("appointments").insert({ resource_id: resourceId, title: "x", starts_at: start, ends_at: end });
    expect((await mk("2030-01-01T10:00:00Z", "2030-01-01T11:00:00Z")).error).toBeNull();
    expect((await mk("2030-01-01T10:30:00Z", "2030-01-01T11:30:00Z")).error?.code).toBe("23P01");
  });

  it("documents are only registered under the caller's organization path", async () => {
    const { error } = await a.client
      .from("documents")
      .insert({ case_id: caseId, name: "x.pdf", storage_path: `org/${b.orgId}/case/${caseId}/x.pdf` });
    expect(error).not.toBeNull();
  });
});
