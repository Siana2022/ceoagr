"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import type { NavItem } from "@/lib/modules/nav";

export function MobileNav({ items, orgName }: { items: NavItem[]; orgName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between bg-sidebar px-4 py-3 text-white">
        <span className="font-heading text-lg font-bold tracking-tight">AGR</span>
        <span className="truncate px-3 text-sm text-white/70">{orgName}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="rounded-lg p-1.5 hover:bg-white/10"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="bg-sidebar pb-3">
          <Sidebar items={items} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
