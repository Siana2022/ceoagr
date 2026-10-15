import { NextResponse } from "next/server";
import { TEMPLATE_HEADERS } from "@/lib/modules/contacts/csv";

export async function GET() {
  const sample = [
    ["Empresa", "Construcciones Levante", "Construcciones Levante S.L.", "B12345678", "info@levante.example", "961112233", "600112233", "Calle Mayor 1", "46001", "Valencia", "Valencia", "España", "cliente|obras", "Recomendación"],
    ["Persona", "Ana Pérez", "", "12345678Z", "ana@example.com", "", "611223344", "", "", "Madrid", "Madrid", "España", "particular", "Web"],
  ];
  const body = "﻿" + [TEMPLATE_HEADERS, ...sample].map((r) => r.join(";")).join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-contactos.csv"',
    },
  });
}
