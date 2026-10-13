"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/modules/nav";

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const base = "rounded-[5px] px-3 py-2 text-sm";

        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className={`${base} flex items-center justify-between text-zinc-400`}
            >
              {item.label}
              <span className="text-[10px] uppercase tracking-wide">Pronto</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${base} ${
              active
                ? "bg-brand font-medium text-white"
                : "text-zinc-800 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
