"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckSquare,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
  Timer,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/modules/nav";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  contacts: Users,
  cases: Briefcase,
  tasks: CheckSquare,
  calendar: CalendarDays,
  documents: FileText,
  time: Timer,
  clock: Clock,
  dashboards: BarChart3,
  opportunities: TrendingUp,
  settings: Settings,
};

export function Sidebar({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const base = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium";

        if (!item.ready) {
          return (
            <span key={item.href} aria-disabled="true" className={`${base} cursor-not-allowed text-white/35`}>
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Pronto</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`${base} transition-colors ${
              active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            <Icon size={18} className={active ? "text-accent" : ""} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
