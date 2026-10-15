// Duplicate detection for contacts (pure, unit-tested).

export type DupContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  tax_id: string | null;
  created_at: string;
};

export const normEmail = (v: string | null | undefined) => {
  const s = (v ?? "").trim().toLowerCase();
  return s.includes("@") ? s : "";
};

// Spanish-friendly: digits only, without the +34 / 0034 prefix.
export const normPhone = (v: string | null | undefined) => {
  let d = (v ?? "").replace(/\D/g, "");
  if (d.startsWith("0034") && d.length > 9) d = d.slice(4);
  else if (d.startsWith("34") && d.length === 11) d = d.slice(2);
  return d.length >= 6 ? d : "";
};

export const normTaxId = (v: string | null | undefined) => {
  const s = (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length >= 5 ? s : "";
};

export type DupReason = "email" | "phone" | "tax_id";

export function contactKeys(c: Pick<DupContact, "email" | "phone" | "mobile" | "tax_id">) {
  const keys: { key: string; reason: DupReason }[] = [];
  const e = normEmail(c.email);
  if (e) keys.push({ key: `e:${e}`, reason: "email" });
  for (const p of [normPhone(c.phone), normPhone(c.mobile)]) {
    if (p && !keys.some((k) => k.key === `p:${p}`)) keys.push({ key: `p:${p}`, reason: "phone" });
  }
  const t = normTaxId(c.tax_id);
  if (t) keys.push({ key: `t:${t}`, reason: "tax_id" });
  return keys;
}

export type DupGroup = { contacts: DupContact[]; reasons: DupReason[] };

// Contacts sharing any key end up in the same group (transitively).
export function findDuplicateGroups(contacts: DupContact[]): DupGroup[] {
  const parent = new Map<string, string>(contacts.map((c) => [c.id, c.id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let cur = x;
    while (parent.get(cur) !== r) {
      const next = parent.get(cur)!;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const byKey = new Map<string, { id: string; reason: DupReason }[]>();
  for (const c of contacts) {
    for (const k of contactKeys(c)) byKey.set(k.key, [...(byKey.get(k.key) ?? []), { id: c.id, reason: k.reason }]);
  }
  const reasonsByRoot = new Map<string, Set<DupReason>>();
  for (const members of byKey.values()) {
    if (members.length < 2) continue;
    for (let i = 1; i < members.length; i++) union(members[0].id, members[i].id);
  }
  for (const members of byKey.values()) {
    if (members.length < 2) continue;
    const root = find(members[0].id);
    const set = reasonsByRoot.get(root) ?? new Set<DupReason>();
    set.add(members[0].reason);
    reasonsByRoot.set(root, set);
  }

  const groups = new Map<string, DupContact[]>();
  for (const c of contacts) {
    const r = find(c.id);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([root, list]) => ({
      contacts: list.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      reasons: [...(reasonsByRoot.get(root) ?? [])],
    }))
    .sort((a, b) => b.contacts.length - a.contacts.length);
}

// Completeness score used to suggest which contact should be the primary one.
export function completeness(c: DupContact) {
  return [c.email, c.phone, c.mobile, c.tax_id].filter(Boolean).length;
}
