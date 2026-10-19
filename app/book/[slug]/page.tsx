import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicBookingInfo } from "@/lib/modules/booking/public";
import { RESOURCE_KIND_LABELS } from "@/lib/modules/agenda/types";
import type { ResourceKind } from "@/lib/modules/agenda/types";

async function OrgBookingContent({ params }: Pick<PageProps<"/book/[slug]">, "params">) {
  const { slug } = await params;
  const info = await getPublicBookingInfo(slug);
  if (!info) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        {info.org_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.org_logo} alt={info.org_name} className="max-h-16 max-w-full object-contain" />
        ) : (
          <h1 className="text-2xl font-bold" style={{ color: info.org_color }}>{info.org_name}</h1>
        )}
        <p className="text-sm text-muted">Pide tu cita online. Te confirmaremos el horario en cuanto lo revisemos.</p>
      </header>

      <ul className="flex flex-col gap-3">
        {info.resources.map((r) => (
          <li key={r.id}>
            <Link
              href={`/book/${slug}/${r.id}`}
              className="card flex items-center justify-between gap-3 p-5 transition-shadow hover:shadow-md"
            >
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-sm text-muted">{RESOURCE_KIND_LABELS[r.kind as ResourceKind] ?? r.kind}</span>
              </span>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden="true" />
            </Link>
          </li>
        ))}
        {info.resources.length === 0 && (
          <li className="card p-6 text-center text-sm text-muted">Ahora mismo no hay nada disponible para reservar online.</li>
        )}
      </ul>
    </main>
  );
}

export default function PublicBookingOrgPage(props: PageProps<"/book/[slug]">) {
  return (
    <Suspense fallback={null}>
      <OrgBookingContent params={props.params} />
    </Suspense>
  );
}
