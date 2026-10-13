import { z } from "zod";

export const CONFIGURABLE_FIELDS = [
  "legal_name",
  "tax_id",
  "email",
  "phone",
  "mobile",
  "source",
] as const;
export type ConfigurableField = (typeof CONFIGURABLE_FIELDS)[number];

export const FIELD_LABELS: Record<ConfigurableField, string> = {
  legal_name: "Razón social",
  tax_id: "NIF / CIF",
  email: "Email",
  phone: "Teléfono",
  mobile: "Móvil",
  source: "Origen",
};

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optText = z
  .preprocess(emptyToNull, z.string().trim().max(200).nullish())
  .transform((v) => v ?? null);

const optEmail = z
  .preprocess(emptyToNull, z.email("Email no válido").max(200).nullish())
  .transform((v) => v ?? null);

const baseSchema = z.object({
  kind: z.enum(["person", "company"], "Indica si es persona o empresa"),
  name: z.string().trim().min(1, "Indica el nombre").max(200),
  legal_name: optText,
  tax_id: optText,
  email: optEmail,
  phone: optText,
  mobile: optText,
  source: optText,
  tags: z.preprocess(
    (v) =>
      typeof v === "string"
        ? v.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    z.array(z.string().max(50)).max(20, "Máximo 20 etiquetas"),
  ),
  address: z.object({
    street: optText,
    city: optText,
    postal_code: optText,
    province: optText,
    country: optText,
  }),
});

export function buildContactSchema(required: readonly string[]) {
  return baseSchema.superRefine((data, ctx) => {
    for (const field of CONFIGURABLE_FIELDS) {
      if (required.includes(field) && !data[field]) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${FIELD_LABELS[field]} es obligatorio`,
        });
      }
    }
  });
}

export type ContactInput = z.output<ReturnType<typeof buildContactSchema>>;

export function formToInput(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    kind: g("kind"),
    name: g("name"),
    legal_name: g("legal_name"),
    tax_id: g("tax_id"),
    email: g("email"),
    phone: g("phone"),
    mobile: g("mobile"),
    source: g("source"),
    tags: g("tags"),
    address: {
      street: g("address_street"),
      city: g("address_city"),
      postal_code: g("address_postal_code"),
      province: g("address_province"),
      country: g("address_country"),
    },
  };
}

export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
