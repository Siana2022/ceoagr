# Decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-13 | Next.js 16.4 (última estable) en lugar de 15 | La spec dice 15; se usa la última estable. Leer `node_modules/next/dist/docs/` antes de codificar. |
| 2026-10-13 | Supabase y Vercel se configuran más adelante | Decisión del usuario: primero avanzar el código; la carpeta `supabase/` y el despliegue llegan después. |
| 2026-10-13 | La organización activa se obtiene de `memberships` (función `current_org_id()`), no del JWT `app_metadata` | Evita configurar un hook de auth; los cambios de rol/organización se aplican al instante. La RLS es equivalente. |
| 2026-10-13 | Un usuario pertenece a una sola organización (`memberships.user_id` único) | Decisión de diseño inicial; ampliar a multi-organización exigiría cambiar la migración base. |
| 2026-10-13 | Next 16 con `cacheComponents`: el acceso a cookies/searchParams va dentro de `<Suspense>` | Requerido por el prerender; el build falla si no. |
| 2026-10-13 | Visibilidad de contactos: owner/admin/readonly ven todos; manager los suyos y los de su equipo; member los asignados o compartidos (`record_shares`) | Decisión del usuario. Implementado en `can_view_contact` / `can_edit_contact` (RLS). |
| 2026-10-13 | Campos obligatorios de contacto configurables por owner/admin/manager (nombre y tipo siempre obligatorios) | Decisión del usuario. Se guarda en `organizations.settings.contacts.required_fields` vía RPC `set_contact_required_fields`; se valida en servidor con Zod. |
| 2026-10-13 | Los contactos no se borran desde la app, solo se archivan | Spec 4.10 (borrado lógico). Solo owner/admin pueden borrar definitivamente en BBDD. |
| 2026-10-13 | `@types/node` 22 | Requerido por Vitest 5. |
| 2026-10-13 | Tipos de expediente: solo owner/admin los configuran; plantillas y recursos: owner/admin/manager | Los tipos afectan a toda la organización y a los datos existentes. |
| 2026-10-13 | La agenda es compartida dentro de la organización (todos ven todas las citas); editar/borrar: creador u owner/admin/manager | Necesario para detectar solapes entre usuarios. El solape se impide en BBDD con una restricción de exclusión (btree_gist). |
| 2026-10-13 | Documentos: ruta `org/{org_id}/{entidad}/{id}/{uuid}-{archivo}`, bucket privado, descarga vía `/documents/[id]/download` (URL firmada de 60 s emitida solo si RLS deja ver la fila) | Spec 5.5. |
| 2026-10-13 | Plantillas generan HTML descargable; PDF/DOCX pendientes | Decisión abierta (spec §9): librería de PDF/DOCX. |
| 2026-10-13 | Horas de las citas en Europe/Madrid, guardadas en UTC | Gestión desde España; helpers con tests incl. cambio de hora. |
