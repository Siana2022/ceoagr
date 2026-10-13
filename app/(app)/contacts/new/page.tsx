import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/modules/session";
import { canWrite } from "@/lib/modules/nav";
import { getRequiredFields } from "@/lib/modules/contacts/queries";
import { createContact } from "@/lib/modules/contacts/actions";
import { ContactForm } from "@/components/contacts/ContactForm";

export default async function NewContactPage() {
  const role = await getCurrentRole();
  if (!role || !canWrite(role)) redirect("/contacts");
  const required = await getRequiredFields();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Nuevo contacto</h1>
      <ContactForm action={createContact} required={required} cancelHref="/contacts" submitLabel="Crear contacto" />
    </div>
  );
}
