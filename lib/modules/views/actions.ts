"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";

const ENTITY_PATH = { contacts: "/contacts", cases: "/cases", tasks: "/tasks", opportunities: "/opportunities" } as const;
const entitySchema = z.enum(["contacts", "cases", "tasks", "opportunities"]);

const filtersSchema = z.record(z.string().max(60), z.string().max(200)).refine((o) => Object.keys(o).length <= 12);
const columnsSchema = z.array(z.string().max(30)).max(20);

export async function saveView(entity: string, fd: FormData) {
  const e = entitySchema.safeParse(entity);
  if (!e.success) redirect("/");
  const base = ENTITY_PATH[e.data];

  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect(base);

  const name = z.string().trim().min(1).max(60).safeParse(fd.get("name"));
  let filters: unknown = {};
  let columns: unknown = [];
  try {
    filters = JSON.parse(String(fd.get("filters") ?? "{}"));
    columns = JSON.parse(String(fd.get("columns") ?? "[]"));
  } catch {
    redirect(`${base}?view_error=1`);
  }
  const f = filtersSchema.safeParse(filters);
  const c = columnsSchema.safeParse(columns);
  if (!name.success || !f.success || !c.success) redirect(`${base}?view_error=1`);

  const shared = fd.get("is_shared") === "on" && isStaffRole(role);
  const supabase = await createClient();
  const { error } = await supabase.from("saved_views").upsert(
    { entity: e.data, name: name.data, filters: f.data, columns: c.data, is_shared: shared },
    { onConflict: "user_id,entity,name" },
  );
  redirect(error ? `${base}?view_error=1` : `${base}?view_saved=1`);
}

export async function deleteView(entity: string, id: string) {
  const e = entitySchema.safeParse(entity);
  if (e.success && z.uuid().safeParse(id).success) {
    const supabase = await createClient();
    await supabase.from("saved_views").delete().eq("id", id);
  }
  redirect(e.success ? ENTITY_PATH[e.data] : "/");
}
