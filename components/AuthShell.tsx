import { Brand } from "@/components/Brand";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-accent/10"
        />
        <Brand light />
        <div className="relative max-w-md">
          <h2 className="font-heading text-3xl font-semibold leading-tight text-white">
            Toda tu gestión en un solo lugar.
          </h2>
          <p className="mt-4 text-white/65">
            Clientes, expedientes, tareas, agenda y documentos conectados, para que nada se pierda por el camino.
          </p>
        </div>
        <p className="relative text-xs text-white/40">© AGR Integral Engineering Solutions</p>
      </aside>

      <main className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8 flex flex-col gap-5">{children}</div>
        </div>
      </main>
    </div>
  );
}
