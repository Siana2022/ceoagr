import { z } from "zod";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

export const templateFormSchema = z.object({
  name: z.string().trim().min(1, "Indica el nombre").max(120),
  description: z.preprocess(emptyToNull, z.string().trim().max(300).nullish()).transform((v) => v ?? null),
  context: z.enum(["general", "contact", "case", "quote"]),
  body: z.string().max(200_000, "La plantilla es demasiado larga"),
  blocks: z.preprocess((v) => {
    if (typeof v !== "string" || v.trim() === "") return [];
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, z.array(z.record(z.string(), z.unknown())).max(200, "Demasiados bloques")),
  is_default: z.boolean(),
  page_settings: z.object({
    orientation: z.enum(["portrait", "landscape"]),
    margin_mm: z.number().min(10).max(40),
    header_logo: z.boolean(),
    page_numbers: z.boolean(),
    footer_text: z.string().trim().max(300),
  }),
});

export function readTemplateForm(fd: FormData) {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  const margin = Number(g("margin_mm").replace(",", "."));
  return templateFormSchema.safeParse({
    name: g("name"),
    description: g("description"),
    context: g("context") || "general",
    body: g("body"),
    blocks: g("blocks_json"),
    is_default: fd.get("is_default") === "on",
    page_settings: {
      orientation: g("orientation") === "landscape" ? "landscape" : "portrait",
      margin_mm: Number.isFinite(margin) && g("margin_mm") !== "" ? margin : 20,
      header_logo: fd.get("header_logo") === "on",
      page_numbers: fd.get("page_numbers") === "on",
      footer_text: g("footer_text"),
    },
  });
}
