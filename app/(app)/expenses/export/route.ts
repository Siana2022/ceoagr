import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { isAdminRole } from "@/lib/modules/nav";
import { listExpenses } from "@/lib/modules/expenses/queries";
import { KIND_LABELS, STATUS_LABELS, type ExpenseStatus } from "@/lib/modules/expenses/types";
import { isMonth, monthRange } from "@/lib/modules/clock/calc";
import { csvCell } from "@/lib/modules/time/calc";
import { todayMadrid } from "@/lib/modules/format";

export async function GET(req: Request) {
  const role = await getCurrentRole();
  if (!role || !isAdminRole(role)) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const m = url.searchParams.get("month");
  const month = isMonth(m) ? m : todayMadrid().slice(0, 7);
  const r = monthRange(month);
  const s = url.searchParams.get("status");
  const status = (["submitted", "approved", "rejected", "reimbursed"] as const).find((x) => x === s);
  const u = url.searchParams.get("user");

  const { rows, names } = await listExpenses({
    status: status as ExpenseStatus | undefined,
    userId: z.uuid().safeParse(u).success ? (u as string) : undefined,
    fromDate: r.first,
    toDate: `${month}-${String(r.daysInMonth).padStart(2, "0")}`,
    limit: 5000,
  });

  const eur = (n: number) => n.toFixed(2).replace(".", ",");
  const header = ["Fecha", "Persona", "Tipo", "Concepto", "Proyecto", "Cantidad", "Precio unitario", "Importe", "Repercutible", "Estado", "Ticket"];
  const body = "﻿" + [
    header,
    ...rows.map((e) => [
      e.expense_date.split("-").reverse().join("/"), names.get(e.user_id) ?? "", KIND_LABELS[e.kind], e.description ?? "",
      e.cases?.code ?? "General", String(e.quantity).replace(".", ","), eur(e.unit_amount), eur(e.amount),
      e.billable ? "Sí" : "No", STATUS_LABELS[e.status], e.receipt_path ? "Sí" : "No",
    ]),
  ].map((row) => row.map(csvCell).join(";")).join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos-${month}.csv"`,
    },
  });
}
