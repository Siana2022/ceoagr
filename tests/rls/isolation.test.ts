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
});
