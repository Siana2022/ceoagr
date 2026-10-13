export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div>
      <p className={`font-heading text-4xl font-bold leading-none tracking-tight ${light ? "text-white" : "text-black"}`}>
        AGR
      </p>
      <p className={`mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] ${light ? "text-white/60" : "text-slate-500"}`}>
        Integral Engineering Solutions
      </p>
    </div>
  );
}
