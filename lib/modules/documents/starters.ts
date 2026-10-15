import type { PageSettings } from "@/lib/modules/pdf/engine";
import type { TemplateContextKind } from "./variables";

export type StarterTemplate = {
  name: string;
  description: string;
  context: TemplateContextKind;
  is_default: boolean;
  page_settings: PageSettings;
  body: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Presupuesto estándar",
    description: "Presupuesto con tabla de líneas, totales y condiciones.",
    context: "quote",
    is_default: true,
    page_settings: { header_logo: true, page_numbers: true },
    body: `<h1>Presupuesto {{quote.number}}</h1>
<p><strong>Fecha:</strong> {{quote.issue_date}} · <strong>Válido hasta:</strong> {{quote.valid_until}}</p>
<h3>Cliente</h3>
<p>{{contact.name}}<br>NIF/CIF: {{contact.tax_id}}<br>{{contact.address}}</p>
<h2>{{quote.title}}</h2>
<p>{{quote.lines_table}}</p>
<p>{{quote.totals_table}}</p>
<h3>Condiciones y notas</h3>
<p>{{quote.notes}}</p>
<p></p>
<p>Atentamente,<br>{{user.name}}<br>{{org.name}}</p>`,
  },
  {
    name: "Carta al cliente",
    description: "Carta formal con fecha, destinatario y firma.",
    context: "contact",
    is_default: true,
    page_settings: { header_logo: true, page_numbers: false },
    body: `<p style="text-align: right">Valencia, {{today}}</p>
<p>{{contact.name}}<br>{{contact.address}}</p>
<p></p>
<p>Estimado/a cliente:</p>
<p>Escribe aquí el contenido de la carta.</p>
<p></p>
<p>Un cordial saludo,</p>
<p>{{user.name}}<br>{{org.name}}</p>`,
  },
  {
    name: "Informe de expediente",
    description: "Resumen de datos de un expediente para el cliente.",
    context: "case",
    is_default: true,
    page_settings: { header_logo: true, page_numbers: true },
    body: `<h1>Informe del expediente {{case.code}}</h1>
<h2>{{case.title}}</h2>
<table data-widths="140,*"><tbody>
<tr><td><strong>Cliente</strong></td><td>{{contact.name}}</td></tr>
<tr><td><strong>Estado</strong></td><td>{{case.status}}</td></tr>
<tr><td><strong>Apertura</strong></td><td>{{case.opened_at}}</td></tr>
<tr><td><strong>Fecha límite</strong></td><td>{{case.due_at}}</td></tr>
</tbody></table>
<h3>Resumen</h3>
<p>Describe aquí el estado del trabajo.</p>
<p></p>
<p>{{user.name}} · {{org.name}} · {{today}}</p>`,
  },
];
