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

### Fase 1 · Expedientes, Tareas, Agenda, Documentos
- Migraciones `…0200_cases`, `…0300_tasks`, `…0400_agenda`, `…0500_documents` (con RLS, índices, triggers de historial/auditoría).
- Expedientes: tipos configurables (estados y campos), código automático `PREFIJO-AAAA-NNNN`, vista tabla y tablero, historial, campos validados en servidor.
- Tareas: mis tareas / equipo, subtareas, checklist, vencidas resaltadas, integradas en expedientes y contactos.
- Agenda: vistas día/semana/mes, recursos con color, citas con estados, solapes bloqueados en BBDD.
- Documentos: subida privada, versionado, vista previa PDF/imagen, descarga con URL firmada, plantillas con variables → HTML.
- Ficha 360º de contacto: Resumen, Expedientes, Tareas, Agenda, Documentos.
- Panel con contadores reales.

### Flujo de trabajo de ingeniería
1. Tareas automáticas por fase (Ajustes → Tipos de expediente → Tareas por fase).
2. Control de horas y rentabilidad: temporizador y horas manuales, tarifas por profesional (coste y precio), informes por proyecto/cliente/persona con margen, exportación CSV, alertas de desviación y notificaciones.
3. Oportunidades y presupuestos: embudo, presupuestos con líneas, estados, documento HTML, conversión a proyecto.
4. Control horario: fichar entrada/salida/pausa, vista mensual, vista de equipo, correcciones manuales con motivo, CSV de resumen y de registro completo.
5. Cuadros de mando: proyectos por estado, horas frente a presupuesto, carga por persona, tareas vencidas, embudo, ocupación de agenda, rentabilidad y horas fichadas frente a imputadas.
- Gestión de usuarios por el administrador; sin registro público.
- Migraciones: `…0600_task_templates`, `…0610_visibility_by_assignment`, `…0700_time_tracking`, `…0800_opportunities`, `…0900_clock`.

### Contactos entrega B y búsqueda global
- Fusión de duplicados (página «Duplicados», RPC `merge_contacts`) y aviso al crear un contacto repetido.
- Importar contactos desde CSV (vista previa, errores por fila, omitir duplicados) y exportar CSV con los filtros activos; plantilla descargable.
- Relaciones entre contactos (empleado de, socio de…) y compartir contactos desde la ficha.
- Vistas guardadas (privadas o del equipo) y columnas configurables en la lista de contactos.
- Búsqueda global (contactos, expedientes, oportunidades, presupuestos, tareas, documentos) con atajo «/».
- Migración `…1000_contacts_extras`.

### Pendiente (siguiente)
- Fusión de duplicados, relaciones entre contactos, CSV, filtros guardados, columnas configurables, compartir contactos desde la UI.
