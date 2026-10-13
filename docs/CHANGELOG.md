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
