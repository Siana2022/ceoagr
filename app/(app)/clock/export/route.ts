import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/modules/session";
import { isStaffRole } from "@/lib/modules/nav";
import { getUserId } from "@/lib/modules/tasks/queries";
import { listMembers } from "@/lib/modules/members";
import { listMonthEvents } from "@/lib/modules/clock/queries";
import { buildSessions, CLOCK_LABELS, fmtHM, isMonth, summarizeDays, type ClockEvent } from "@/lib/modules/clock/calc";
import { csvCell } from "@/lib/modules/time/calc";
import { fmtDateTime, fmtTime, nowMs, todayMadrid } from "@/lib/modules/format";

export async function GET(req: Request) {
  const role = await getCurrentRole();
  const uid = await getUserId();
  if (!role || !uid) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  const month = isMonth(monthParam) ? monthParam : todayMadrid().slice(0, 7);
  const team = url.searchParams.get("scope") === "team" && isStaffRole(role);
  const detail = url.searchParams.get("detail") === "events";

  const [members, events] = await Promise.all([listMembers(), listMonthEvents(month, team ? undefined : uid)]);
  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const inMonth = events.filter((e) => e.at >= `${month}-01`);

  let header: string[];
  let rows: unknown[][];

  if (detail) {
    header = ["Fecha y hora", "Empleado", "Tipo", "Origen", "Motivo de la corrección"];
    rows = inMonth.map((e) => [fmtDateTime(e.at), names.get(e.user_id) ?? "", CLOCK_LABELS[e.kind], e.source, e.note ?? ""]);
  } else {
    header = ["Fecha", "Empleado", "Entrada", "Salida", "Pausas (min)", "Horas trabajadas", "Observaciones"];
    rows = [];
    const byUser = new Map<string, ClockEvent[]>();
    for (const e of events) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
    for (const [userId, evs] of byUser) {
      const { sessions } = buildSessions(evs, nowMs());
      const days = [...summarizeDays(sessions, evs).values()].filter((d) => d.day.startsWith(month)).sort((a, b) => a.day.localeCompare(b.day));
      for (const d of days) {
        rows.push([
          d.day.split("-").reverse().join("/"), names.get(userId) ?? "", fmtTime(d.first),
          d.open ? "en curso" : d.last ? fmtTime(d.last) : "", d.pauseMin, fmtHM(d.workedMin),
          d.manual ? "Incluye corrección manual" : "",
        ]);
      }
    }
  }

  const body = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fichaje-${month}${detail ? "-registro" : ""}.csv"`,
    },
  });
}
