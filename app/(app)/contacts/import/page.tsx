import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { ImportWizard } from "@/components/contacts/ImportWizard";

export default async function ImportContactsPage() {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect("/contacts");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/contacts" className="link text-sm">← Contactos</Link>
        <h1 className="page-title mt-1">Importar contactos</h1>
        <p className="page-sub">Desde un archivo CSV, con vista previa antes de guardar nada.</p>
      </div>
      <ImportWizard />
    </div>
  );
}
