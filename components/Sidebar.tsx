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
        const base = "rounded-md px-3 py-2 text-sm";

        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className={`${base} flex items-center justify-between text-zinc-400 dark:text-zinc-600`}
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
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
