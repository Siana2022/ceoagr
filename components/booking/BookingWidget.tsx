"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  slug: string;
  resourceId: string;
  resourceName: string;
  color: string;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function nextDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return { dow: DAY_LABELS[d.getDay()], num: d.getDate(), month: d.toLocaleDateString("es-ES", { month: "short" }) };
}

export function BookingWidget({ slug, resourceId, resourceName, color }: Props) {
  const days = useMemo(() => nextDays(21), []);
  const [date, setDate] = useState(days[0]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/book/${slug}/${resourceId}/slots?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSlots(d.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, resourceId, date]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/book/${slug}/${resourceId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          start_time: slot,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          notes: form.get("notes"),
          website: form.get("website"),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDoneMessage(data.message);
        setStep("done");
      } else {
        setError(data.message ?? "No se pudo completar la reserva.");
      }
    } catch {
      setError("No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <p className="alert-ok w-full">{doneMessage}</p>
        <p className="text-sm text-muted">
          {resourceName} · {new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", { dateStyle: "long" })} a las {slot}
        </p>
      </div>
    );
  }

  if (step === "form" && slot) {
    return (
      <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between text-sm">
          <p>
            <strong>{resourceName}</strong> · {new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", { dateStyle: "long" })} a las <strong>{slot}</strong>
          </p>
          <button type="button" onClick={() => setStep("pick")} className="link">Cambiar</button>
        </div>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <label className="field">Nombre *<input name="name" required maxLength={200} className="input" /></label>
        <label className="field">Email *<input name="email" type="email" required maxLength={200} className="input" /></label>
        <label className="field">Teléfono<input name="phone" maxLength={40} className="input" /></label>
        <label className="field">¿Algo que debamos saber?<textarea name="notes" rows={3} maxLength={1000} className="input" /></label>
        {/* Honeypot: real visitors never see or fill this. */}
        <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          No rellenar
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ backgroundColor: color }}>
          {submitting ? "Reservando…" : "Confirmar reserva"}
        </button>
      </form>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const l = dayLabel(d);
          const active = d === date;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDate(d);
                setSlots(null);
                setSlot(null);
              }}
              aria-current={active ? "true" : undefined}
              className="flex w-14 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-xs"
              style={active ? { borderColor: color, backgroundColor: color, color: "white" } : { borderColor: "#e2e8f0" }}
            >
              <span className="uppercase">{l.dow}</span>
              <span className="text-base font-bold">{l.num}</span>
              <span>{l.month}</span>
            </button>
          );
        })}
      </div>

      {slots === null ? (
        <p className="py-6 text-center text-sm text-muted">Cargando horarios…</p>
      ) : slots.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No hay horarios libres este día. Prueba con otra fecha.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSlot(s);
                setStep("form");
              }}
              className="rounded-lg border border-slate-200 py-2 text-sm font-medium hover:border-slate-400"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
