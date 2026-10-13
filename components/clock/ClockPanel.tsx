import { Coffee, LogIn, LogOut, Play } from "lucide-react";
import { clockAction } from "@/lib/modules/clock/actions";
import { fmtHM } from "@/lib/modules/clock/calc";
import { fmtTime } from "@/lib/modules/format";
import { Elapsed } from "@/components/time/Elapsed";

type Props = {
  state: "off" | "working" | "paused";
  since?: string | null; // start of the open session
  workedMin: number;
  back: string;
  canClock: boolean;
};

const STATE_TEXT = { off: "Fuera de jornada", working: "Jornada en curso", paused: "En pausa" } as const;
const DOT = { off: "bg-slate-400", working: "bg-emerald-500", paused: "bg-amber-500" } as const;

export function ClockPanel({ state, since, workedMin, back, canClock }: Props) {
  const btn = (kind: string, label: string, icon: React.ReactNode, primary = false) => (
    <form action={clockAction.bind(null, kind)}>
      <input type="hidden" name="back" value={back} />
      <button type="submit" className={`btn ${primary ? "btn-primary" : "btn-secondary"} h-12 px-6 text-base`}>
        {icon} {label}
      </button>
    </form>
  );

  return (
    <div className="card flex flex-wrap items-center justify-between gap-6 p-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className={`h-2.5 w-2.5 rounded-full ${DOT[state]}`} aria-hidden="true" />
          {STATE_TEXT[state]}
          {since && <span className="font-normal text-muted">· desde las {fmtTime(since)}</span>}
        </p>
        <p className="mt-2 font-heading text-4xl font-bold tabular-nums">
          {state === "working" && since ? <Elapsed since={since} /> : fmtHM(workedMin)}
          <span className="ml-2 text-base font-normal text-muted">{state === "working" ? "sesión actual" : "trabajadas hoy"}</span>
        </p>
        {state === "working" && <p className="mt-1 text-sm text-muted">Hoy llevas {fmtHM(workedMin)} h trabajadas.</p>}
      </div>

      {canClock ? (
        <div className="flex flex-wrap gap-3">
          {state === "off" && btn("in", "Fichar entrada", <LogIn size={18} />, true)}
          {state === "working" && (
            <>
              {btn("pause_start", "Pausa", <Coffee size={18} />)}
              {btn("out", "Fichar salida", <LogOut size={18} />, true)}
            </>
          )}
          {state === "paused" && (
            <>
              {btn("pause_end", "Reanudar", <Play size={18} />, true)}
              {btn("out", "Fichar salida", <LogOut size={18} />)}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Tu usuario no puede fichar.</p>
      )}
    </div>
  );
}
