import Link from "next/link";
import { addDays, madridParts } from "@/lib/modules/format";
import { assignLanes } from "@/lib/modules/agenda/layout";
import type { AppointmentListItem } from "@/lib/modules/agenda/types";

const PX_PER_HOUR = 48;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const idx = (d.getUTCDay() + 6) % 7;
  return `${DAY_NAMES[idx]} ${d.getUTCDate()}`;
}

function blockStyle(color: string, cancelled: boolean) {
  return {
    backgroundColor: `${color}${cancelled ? "12" : "26"}`,
    borderLeft: `3px solid ${color}`,
  };
}

type Placed = AppointmentListItem & { start: number; end: number };

function place(appts: AppointmentListItem[], date: string): Placed[] {
  const out: Placed[] = [];
  for (const a of appts) {
    const s = madridParts(a.starts_at);
    if (s.date !== date) continue;
    const e = madridParts(a.ends_at);
    out.push({ ...a, start: s.minutes, end: e.date === date ? e.minutes : 24 * 60 });
  }
  return out;
}

export function TimeGrid({ days, appts, today }: { days: string[]; appts: AppointmentListItem[]; today: string }) {
  const perDay = days.map((d) => place(appts, d));
  const all = perDay.flat();
  const startHour = Math.min(7, ...all.map((a) => Math.floor(a.start / 60)));
  const endHour = Math.max(21, ...all.map((a) => Math.ceil(a.end / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * PX_PER_HOUR;

  return (
    <div className="table-card">
      <div className="min-w-[640px]">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => (
            <div
              key={d}
              className={`border-l border-zinc-200 py-2 text-center text-sm font-medium ${d === today ? "text-brand" : ""}`}
            >
              {dayLabel(d)}
            </div>
          ))}
        </div>
        <div className="grid border-t border-zinc-200" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-xs text-muted" style={{ top: i * PX_PER_HOUR }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((d, di) => (
            <div
              key={d}
              className="relative border-l border-zinc-200"
              style={{
                height,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${PX_PER_HOUR - 1}px, #e4e4e7 ${PX_PER_HOUR - 1}px, #e4e4e7 ${PX_PER_HOUR}px)`,
              }}
            >
              {assignLanes(perDay[di]).map((a) => {
                const top = ((a.start - startHour * 60) / 60) * PX_PER_HOUR;
                const h = Math.max(20, ((a.end - a.start) / 60) * PX_PER_HOUR - 2);
                const color = a.resources?.color ?? "#003366";
                const cancelled = a.status === "cancelled";
                return (
                  <Link
                    key={a.id}
                    href={`/calendar/${a.id}`}
                    className={`absolute overflow-hidden rounded-[4px] px-1.5 py-0.5 text-xs leading-tight ${cancelled ? "line-through opacity-60" : ""}`}
                    style={{
                      top,
                      height: h,
                      left: `calc(${(a.lane / a.lanes) * 100}% + 1px)`,
                      width: `calc(${100 / a.lanes}% - 2px)`,
                      ...blockStyle(color, cancelled),
                    }}
                    title={`${a.title} · ${a.resources?.name ?? ""}`}
                  >
                    <span className="font-medium">{madridParts(a.starts_at).time}</span> {a.title}
                    {a.contacts?.name && <span className="block truncate text-slate-600">{a.contacts.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MonthGrid({
  gridStart,
  month,
  appts,
  today,
}: {
  gridStart: string;
  month: string; // yyyy-mm
  appts: AppointmentListItem[];
  today: string;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDay = new Map<string, AppointmentListItem[]>();
  for (const a of appts) {
    const d = madridParts(a.starts_at).date;
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }

  return (
    <div className="table-card">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-sm font-medium">
          {DAY_NAMES.map((n) => (<div key={n} className="py-2">{n}</div>))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            const inMonth = d.startsWith(month);
            return (
              <div key={d} className={`min-h-24 border-b border-l border-zinc-200 p-1 text-xs ${inMonth ? "" : "bg-zinc-50 text-slate-400"}`}>
                <Link
                  href={`/calendar?view=day&date=${d}`}
                  className={`inline-block rounded px-1 font-medium ${d === today ? "bg-brand text-white" : ""}`}
                >
                  {Number(d.slice(8))}
                </Link>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {list.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/calendar/${a.id}`}
                        className={`block truncate rounded px-1 ${a.status === "cancelled" ? "line-through opacity-60" : ""}`}
                        style={blockStyle(a.resources?.color ?? "#003366", a.status === "cancelled")}
                      >
                        {madridParts(a.starts_at).time} {a.title}
                      </Link>
                    </li>
                  ))}
                  {list.length > 3 && (
                    <li>
                      <Link href={`/calendar?view=day&date=${d}`} className="link">+{list.length - 3} más</Link>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
