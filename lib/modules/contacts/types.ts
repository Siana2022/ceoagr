export type ContactKind = "person" | "company";

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  person: "Persona",
  company: "Empresa",
};

export type Address = {
  street?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  country?: string;
};

export type Contact = {
  id: string;
  org_id: string;
  kind: ContactKind;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: Address;
  tags: string[];
  source: string | null;
  owner_id: string | null;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactListItem = Pick<
  Contact,
  "id" | "kind" | "name" | "email" | "phone" | "tags" | "owner_id" | "archived" | "created_at"
>;

export type ContactFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | undefined;
