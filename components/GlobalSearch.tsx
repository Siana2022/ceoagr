"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function GlobalSearch() {
  const ref = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/search" ? (params.get("q") ?? "") : "";

  // Press "/" anywhere (outside form fields) to jump to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form key={current} action="/search" method="get" role="search" className="relative w-full max-w-sm">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        ref={ref}
        name="q"
        type="search"
        defaultValue={current}
        minLength={2}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore
        placeholder="Buscar en todo…  ( / )"
        aria-label="Buscar en toda la aplicación"
        className="input h-10 pl-9"
      />
    </form>
  );
}
