import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole, isStaffRole } from "@/lib/modules/nav";
import { buildTimeReport, defaultPeriod } from "@/lib/modules/time/report";
import { csvCell } from "@/lib/modules/time/calc";
import { isDateString, todayMadrid } from "@/lib/modules/format";

export async function GET(req: Request) {
  const role = await getCurrentRole();
  if (!role || !isStaffRole(role)) return new NextResponse("Forbidden", { status: 403 });
  const money = isAdminRole(role);

  const url = new URL(req.url);
  const def = defaultPeriod(todayMadrid());
  const fromP = url.searchParams.get("from");
  const toP = url.searchParams.get("to");
  const from = isDateString(fromP) ? fromP : def.from;
  const to = isDateString(toP) ? toP : def.to;
  const by = url.searchParams.get("by");

  const r = await buildTimeReport(from, to);
  const h = (min: number) => (min / 60).toFixed(2).replace(".", ",");
  const m = (v: number | null) => (v === null ? "" : v.toFixed(2).replace(".", ","));

  let header: string[];
  let rows: unknown[][];
  if (by === "user") {
    header = ["Persona", "Horas", "Facturables", ...(money ? ["Coste", "Valor"] : [])];
    rows = r.byUser.map((u) => [u.name, h(u.minutes), h(u.billable), ...(money ? [m(u.cost), m(u.value)] : [])]);
  } else if (by === "client") {
    header = ["Cliente", "Proyectos", "Horas", "Facturables", ...(money ? ["Coste", "Valor"] : [])];
    rows = r.byClient.map((c) => [c.name, c.cases, h(c.minutes), h(c.billable), ...(money ? [m(c.cost), m(c.value)] : [])]);
  } else {
    header = ["Código", "Título", "Cliente", "Horas periodo", "Horas acumuladas", "Presupuesto h", "% consumido", ...(money ? ["Coste", "Honorarios", "Margen"] : [])];
    rows = r.byCase.map((c) => [
      c.code, c.title, c.client, h(c.periodMinutes), h(c.totalMinutes), c.budgetHours ?? "",
      c.pct === null ? "" : Math.round(c.pct),
      ...(money ? [m(c.cost), m(c.feeAmount), m(c.margin)] : []),
    ]);
  }

  const body = "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="horas-${from}_${to}.csv"`,
    },
  });
}
