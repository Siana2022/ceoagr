// Template rendering: {{contact.name}}, {{case.code}}, {{case.custom.superficie}}, {{today}}...
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type TemplateContext = Record<string, unknown>;

function lookup(ctx: TemplateContext, path: string): unknown {
  let cur: unknown = ctx;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && Object.prototype.hasOwnProperty.call(cur, part)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function renderTemplate(body: string, ctx: TemplateContext) {
  const unknown = new Set<string>();
  const html = body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path: string) => {
    const v = lookup(ctx, path);
    if (v === undefined) {
      unknown.add(path);
      return "";
    }
    return v === null ? "" : escapeHtml(String(v));
  });
  return { html, unknown: [...unknown] };
}

export function wrapHtml(title: string, inner: string) {
  if (/<html[\s>]/i.test(inner)) return inner;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#222;max-width:800px;margin:2rem auto;line-height:1.5}</style>
</head><body>
${inner}
</body></html>`;
}

export const TEMPLATE_VARIABLES = [
  "contact.name",
  "contact.legal_name",
  "contact.tax_id",
  "contact.email",
  "contact.phone",
  "contact.mobile",
  "contact.address",
  "case.code",
  "case.title",
  "case.status",
  "case.priority",
  "case.due_at",
  "case.custom.<campo>",
  "org.name",
  "user.name",
  "today",
];
