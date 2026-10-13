import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite, isStaffRole } from "@/lib/modules/nav";
import { listMembers } from "@/lib/modules/members";
import { listCaseTypes, listContactOptions } from "@/lib/modules/cases/queries";
import { createCase } from "@/lib/modules/cases/actions";
import { CaseForm } from "@/components/cases/CaseForm";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NewCasePage({ searchParams }: PageProps<"/cases/new">) {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect("/cases");

  const sp = await searchParams;
  const types = await listCaseTypes();
  const contactParam = first(sp.contact);
  const presetContact = z.uuid().safeParse(contactParam).success ? contactParam : undefined;

  if (types.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Nuevo expediente</h1>
        <p className="text-sm">
          Aún no hay tipos de expediente. Un administrador debe crearlos en{" "}
          <Link href="/settings/case-types" className="underline">Ajustes → Tipos de expediente</Link>.
        </p>
      </div>
    );
  }

  const type = types.find((t) => t.id === first(sp.type)) ?? (types.length === 1 ? types[0] : undefined);
  if (!type) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Nuevo expediente</h1>
        <p className="text-sm">¿De qué tipo?</p>
        <ul className="flex flex-col gap-2">
          {types.map((t) => (
            <li key={t.id}>
              <Link
                href={`/cases/new?type=${t.id}${presetContact ? `&contact=${presetContact}` : ""}`}
                className="inline-block rounded-[5px] border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const [contacts, members] = await Promise.all([
    listContactOptions(),
    isStaffRole(role) ? listMembers() : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nuevo: {type.label_singular}</h1>
      <CaseForm
        action={createCase}
        type={type}
        contacts={contacts}
        members={members}
        presetContact={presetContact}
        cancelHref="/cases"
        submitLabel="Crear"
      />
    </div>
  );
}
