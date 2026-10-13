# Changelog

## Fase 0 (en curso)
- Proyecto Next.js 16 + TypeScript + Tailwind inicializado.
- Migración `20261013000000_phase0_core.sql` aplicada en Supabase (organizaciones, perfiles, equipos, membresías, permisos, invitaciones, RLS).
- Login, registro, cierre de sesión y alta de organización (Server Actions + Zod).
- Proxy que refresca la sesión y protege las rutas.

### Pendiente en Fase 0
- Claves de Supabase en `.env.local` (no se suben al repo).
- Invitar usuarios y pantalla de aceptación.
- shadcn/ui, Vitest, Playwright, CI y test e2e de aislamiento entre organizaciones.

### Layout de la app
- Menú lateral con secciones por rol (Ajustes solo owner/admin); módulos aún no construidos marcados "Pronto".
- Panel con tarjetas de contadores (miembros reales; el resto se activará con cada módulo).
- Ajustes · Equipo: listado de miembros con rol y estado.

### Fase 1 · Contactos, entrega A
- Migración `20261013000100_contacts.sql`: contacts, contact_relations, record_shares, audit_log (trigger), RLS por rol/equipo, RPC de campos obligatorios.
- Listado con búsqueda, filtros (tipo, etiqueta, archivados), ordenación y paginación en servidor.
- Alta, edición, archivado/restauración y ficha con pestaña Resumen.
- Ajustes: campos obligatorios configurables (owner/admin/manager).
- Tests: esquema Zod (Vitest) y aislamiento entre organizaciones (`RUN_RLS_TESTS=1`, requiere `SUPABASE_SERVICE_ROLE_KEY`).

### Identidad visual
- Tema claro con la imagen de AGR (grupoagringenieria.com): azul #003366, barra superior negra, acento #F5C2A1, Work Sans + Roboto.

### Pendiente (entrega B)
- Fusión de duplicados, relaciones entre contactos, CSV, filtros guardados, columnas configurables, compartir contactos desde la UI.
