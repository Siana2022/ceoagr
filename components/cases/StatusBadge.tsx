import type { PipelineStatus } from "@/lib/modules/cases/types";

export function StatusBadge({ status, fallback }: { status?: PipelineStatus; fallback?: string }) {
  const color = status?.color ?? "#64748b";
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {status?.label ?? fallback ?? "—"}
    </span>
  );
}
