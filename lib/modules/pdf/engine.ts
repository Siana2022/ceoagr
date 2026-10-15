import "server-only";
import pdfmakeLib from "pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { roboto_italic, roboto_medium, roboto_mediumItalic, roboto_regular } from "./fonts.generated";
import { DEFAULT_THEME, htmlToPdfContent, type PdfTheme } from "./html";

export type PageSettings = {
  orientation?: "portrait" | "landscape";
  margin_mm?: number;
  header_logo?: boolean;
  page_numbers?: boolean;
  footer_text?: string;
};

export type PdfBranding = {
  name?: string;
  color?: string;
  logo_data?: string | null; // data:image/png|jpeg;base64,...
  footer_text?: string;
};

export const DEFAULT_PAGE_SETTINGS: Required<PageSettings> = {
  orientation: "portrait",
  margin_mm: 20,
  header_logo: true,
  page_numbers: true,
  footer_text: "",
};

// @types/pdfmake describes the 0.2 browser API; this is the 0.3 server API we use.
type PdfMake = {
  virtualfs: { writeFileSync(name: string, content: Buffer): void };
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  setLocalAccessPolicy(cb: (path: string) => boolean): void;
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Uint8Array> };
};
const pdfmake = pdfmakeLib as unknown as PdfMake;

let ready = false;
function init() {
  if (ready) return;
  const files: Record<string, string> = {
    "Roboto-Regular.ttf": roboto_regular,
    "Roboto-Medium.ttf": roboto_medium,
    "Roboto-Italic.ttf": roboto_italic,
    "Roboto-MediumItalic.ttf": roboto_mediumItalic,
  };
  for (const [name, b64] of Object.entries(files)) pdfmake.virtualfs.writeFileSync(name, Buffer.from(b64, "base64"));
  pdfmake.setFonts({
    Roboto: { normal: "Roboto-Regular.ttf", bold: "Roboto-Medium.ttf", italics: "Roboto-Italic.ttf", bolditalics: "Roboto-MediumItalic.ttf" },
  });
  // Templates can never make the server fetch URLs or read files.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => false);
  ready = true;
}

const mm = (v: number) => (v * 72) / 25.4;
const hex = (v?: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : DEFAULT_THEME.brand);

function soften(color: string): string {
  const n = Number.parseInt(color.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.88);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
}

export function buildDefinition(html: string, settingsIn: PageSettings = {}, branding: PdfBranding = {}, title = "Documento"): TDocumentDefinitions {
  const s = { ...DEFAULT_PAGE_SETTINGS, ...settingsIn };
  const brand = hex(branding.color);
  const theme: PdfTheme = { brand, brandSoft: soften(brand) };
  const margin = mm(Math.min(Math.max(s.margin_mm, 10), 40));
  const showHeader = s.header_logo && (!!branding.logo_data || !!branding.name);
  const footerText = (s.footer_text || branding.footer_text || "").trim();

  const def: TDocumentDefinitions = {
    info: { title, author: branding.name ?? "" },
    pageSize: "A4",
    pageOrientation: s.orientation,
    pageMargins: [margin, showHeader ? margin + 34 : margin, margin, margin + 14],
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25, color: "#1e293b" },
    content: htmlToPdfContent(html, theme),
  };

  if (showHeader) {
    def.header = () => ({
      margin: [margin, margin * 0.6, margin, 0],
      columns: [
        branding.logo_data ? ({ image: branding.logo_data, fit: [110, 38] } as Content) : { text: "" },
        { text: branding.logo_data ? "" : (branding.name ?? ""), bold: true, fontSize: 13, color: brand, alignment: "left" },
      ],
    });
  }
  if (footerText || s.page_numbers) {
    def.footer = (current: number, total: number) => ({
      margin: [margin, 8, margin, 0],
      columns: [
        { text: footerText, fontSize: 7.5, color: "#64748b", width: "*" },
        { text: s.page_numbers ? `Página ${current} de ${total}` : "", fontSize: 8, color: "#64748b", alignment: "right", width: 90 },
      ],
    });
  }
  return def;
}

export async function renderPdf(html: string, settings?: PageSettings, branding?: PdfBranding, title?: string): Promise<Buffer> {
  init();
  const doc = pdfmake.createPdf(buildDefinition(html, settings, branding, title));
  return Buffer.from(await doc.getBuffer());
}
