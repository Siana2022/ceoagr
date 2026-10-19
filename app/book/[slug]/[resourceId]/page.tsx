import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicBookingInfo } from "@/lib/modules/booking/public";
import { BookingWidget } from "@/components/booking/BookingWidget";

async function ResourceBookingContent({ params }: Pick<PageProps<"/book/[slug]/[resourceId]">, "params">) {
  const { slug, resourceId } = await params;
  const info = await getPublicBookingInfo(slug);
  const resource = info?.resources.find((r) => r.id === resourceId);
  if (!info || !resource) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-1">
        <Link href={`/book/${slug}`} className="link text-sm">← {info.org_name}</Link>
        <h1 className="text-xl font-bold" style={{ color: info.org_color }}>Reservar: {resource.name}</h1>
        <p className="text-sm text-muted">Elige un día y una hora disponibles.</p>
      </header>
      <BookingWidget slug={slug} resourceId={resourceId} resourceName={resource.name} color={info.org_color} />
    </main>
  );
}

export default function PublicBookingResourcePage(props: PageProps<"/book/[slug]/[resourceId]">) {
  return (
    <Suspense fallback={null}>
      <ResourceBookingContent params={props.params} />
    </Suspense>
  );
}
