import { notFound } from "next/navigation";
import { z } from "zod";
import { getContact, getRequiredFields } from "@/lib/modules/contacts/queries";
import { updateContact } from "@/lib/modules/contacts/actions";
import { ContactForm } from "@/components/contacts/ContactForm";

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, required] = await Promise.all([getContact(id), getRequiredFields()]);
  if (!found) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Editar contacto</h1>
      <ContactForm
        action={updateContact.bind(null, id)}
        required={required}
        contact={found.contact}
        cancelHref={`/contacts/${id}`}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
