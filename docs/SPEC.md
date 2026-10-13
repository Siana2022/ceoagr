# Especificación técnica: Software de gestión vertical (tipo MN program)

> Documento de referencia para Claude Code. Colócalo en `docs/SPEC.md` y añade en el `CLAUDE.md` del repo una línea: "Antes de implementar cualquier módulo, lee `docs/SPEC.md` y trabaja por fases."

---

## 1. Objetivo

Construir un software de gestión en la nube, multiusuario, centrado en la **ficha de cliente** como eje: todo (expedientes/proyectos, tareas, citas, documentos, comunicaciones, tiempos) cuelga de un contacto y queda en su historial.

El producto tiene dos capas:

1. **Núcleo común** (idéntico para cualquier sector).
2. **Capa vertical configurable** (tipos de expediente, campos personalizados, estados, plantillas, terminología) que se define por datos, no por código, para poder adaptarlo a distintos sectores.

### Fuera de alcance de esta especificación
- Facturación, tesorería y contabilidad.
- Cumplimiento RGPD/LOPD formal.
- Migración de datos desde otros sistemas.

> Diseñar sin cerrar puertas: las tablas principales deben poder recibir una futura relación con facturas (`case_id`, `contact_id`), pero **no se implementa nada de facturación ahora**.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend + API | Next.js 15 (App Router), TypeScript estricto, React Server Components |
| UI | Tailwind CSS + shadcn/ui, TanStack Table, React Hook Form + Zod |
| Backend / BBDD | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) |
| Despliegue | Vercel |
| Automatizaciones | n8n (webhooks firmados) y/o Supabase Edge Functions + `pg_cron` |
| Calendario | FullCalendar o equivalente |
| Gantt / Kanban | dnd-kit para Kanban; librería Gantt ligera (fase 4) |
| Tests | Vitest (unitarios), Playwright (e2e críticos) |

Convenciones:
- Migraciones SQL versionadas en `supabase/migrations/`.
- Tipos generados con `supabase gen types typescript`.
- Validación en servidor con Zod en cada Server Action / Route Handler.
- Variables de entorno en `.env.local`; nunca claves en el repo.

---

## 3. Arquitectura

### 3.1 Multi-tenant
Aunque el primer despliegue sea para un solo cliente, **todas las tablas llevan `org_id`** y RLS por organización. Esto permite reutilizar el producto para otros clientes sin reescribir.

### 3.2 Roles y permisos
Roles base por organización (`memberships.role`):

| Rol | Alcance |
|---|---|
| `owner` | Todo, incluida configuración y usuarios |
| `admin` | Todo salvo propiedad de la organización |
| `manager` | Ve y gestiona expedientes de su equipo |
| `member` | Ve solo lo asignado o compartido |
| `readonly` | Solo lectura |

Reglas:
- RLS en **todas** las tablas. Política base: `org_id = auth.jwt() -> app_metadata -> org_id`.
- Visibilidad por registro: `owner_id`, `team_id` y tabla `record_shares` para compartir puntualmente.
- Permisos finos por módulo en tabla `role_permissions (role, module, action)` consultable desde el cliente para ocultar UI, pero **la autorización real siempre en RLS/servidor**.

### 3.3 Estructura del repo

```
/app
  /(auth)            login, invitaciones
  /(app)
    /contacts
    /cases
    /tasks
    /calendar
    /documents
    /inbox           correo + mensajería
    /time            control horario + time report
    /dashboards
    /settings        tipos de expediente, plantillas, usuarios, integraciones
/components
/lib
  /supabase          clientes server/browser, helpers RLS
  /modules           lógica de dominio por módulo
  /integrations      email, whatsapp, signature (interfaces + adaptadores)
/supabase
  /migrations
  /functions
/docs
  SPEC.md
```

---

## 4. Modelo de datos (núcleo)

> Todas las tablas incluyen `id uuid pk default gen_random_uuid()`, `org_id uuid not null`, `created_at`, `updated_at`, `created_by`. Se omiten abajo por brevedad.

### 4.1 Organización y usuarios
```sql
organizations(name, slug, settings jsonb)
profiles(user_id -> auth.users, full_name, avatar_url, phone)
memberships(user_id, role, team_id, active)
teams(name)
role_permissions(role, module, action)
```

### 4.2 Contactos
```sql
contacts(
  kind text check (kind in ('person','company')),
  name, legal_name, tax_id, email, phone, mobile,
  address jsonb, tags text[], source,
  owner_id, custom_fields jsonb, archived bool
)
contact_relations(contact_id, related_contact_id, relation_type)  -- empleado de, cónyuge de...
```

### 4.3 Expedientes / proyectos (entidad configurable)
```sql
case_types(
  name, slug, icon,
  label_singular, label_plural,        -- "Expediente", "Proyecto", "Tratamiento"...
  custom_schema jsonb,                 -- definición de campos (JSON Schema simplificado)
  pipeline jsonb                       -- estados ordenados con color y flags (inicial/final)
)
cases(
  contact_id, case_type_id, code,      -- code autonumérico por tipo
  title, status, priority,
  owner_id, team_id,
  opened_at, due_at, closed_at,
  custom_fields jsonb,
  budget_hours numeric                 -- para rentabilidad (fase 2)
)
case_events(case_id, event_type, actor_id, payload jsonb)  -- historial automático
case_participants(case_id, contact_id, role)
```

### 4.4 Tareas
```sql
tasks(
  case_id null, contact_id null, parent_task_id null,
  title, description, status, priority,
  assignee_id, start_at, due_at, completed_at,
  estimate_minutes, position
)
task_checklists(task_id, label, done)
```

### 4.5 Agenda
```sql
resources(name, kind)                       -- profesional, sala, equipo
appointments(
  resource_id, contact_id, case_id null,
  starts_at, ends_at, status,               -- pendiente, confirmada, cancelada, no_show
  title, notes, source                      -- interna | reserva_online
)
availability_rules(resource_id, weekday, start_time, end_time, valid_from, valid_to)
availability_exceptions(resource_id, date, reason)
```

### 4.6 Documentos
```sql
documents(
  case_id null, contact_id null,
  name, storage_path, mime_type, size_bytes,
  version int, parent_document_id null, tags text[]
)
document_templates(
  name, kind,                               -- docx | html
  body text,                                -- con variables {{contact.name}}, {{case.code}}...
  case_type_id null, variables_schema jsonb
)
```

### 4.7 Comunicaciones
```sql
channel_accounts(kind,                       -- email | whatsapp | sms
  display_name, config jsonb /* cifrado */, active)
messages(
  channel_account_id, direction,             -- in | out
  contact_id null, case_id null,
  subject, body, status, external_id, sent_at, payload jsonb
)
message_templates(name, channel, subject, body, variables_schema jsonb)
reminders(
  appointment_id null, task_id null, message_template_id,
  channel, send_at, status, attempts, last_error
)
```

### 4.8 Tiempo (fase 2)
```sql
clock_events(user_id, kind,                  -- in | out | pause_start | pause_end
  at, source, location jsonb null)           -- control horario
time_entries(
  user_id, case_id null, task_id null,
  started_at, ended_at, minutes, billable bool, description
)                                            -- time report / rentabilidad
```

### 4.9 Transversal
```sql
audit_log(actor_id, entity, entity_id, action, diff jsonb)
notifications(user_id, kind, payload jsonb, read_at)
record_shares(entity, entity_id, user_id, permission)
automations(name, trigger jsonb, conditions jsonb, actions jsonb, active)  -- fase 4
saved_views(user_id, entity, filters jsonb, columns jsonb, is_shared)
```

### 4.10 Reglas de datos
- Índices en `org_id`, claves foráneas y campos de filtrado frecuente.
- Búsqueda: `tsvector` + `pg_trgm` en contactos, expedientes y documentos (nombre).
- Borrado lógico (`archived`/`deleted_at`) en contactos, expedientes y documentos.
- Triggers para `updated_at`, `case_events` y `audit_log`.
- Campos personalizados validados contra `case_types.custom_schema` en servidor.

---

## 5. Módulos y requisitos funcionales

### 5.1 Contactos / BBDD
- Alta, edición, archivado, fusión de duplicados (por email/teléfono/NIF).
- Ficha 360º con pestañas: Resumen, Expedientes, Tareas, Agenda, Documentos, Comunicaciones, Tiempo.
- Tabla con filtros guardados, ordenación, columnas configurables, etiquetas y acciones en bloque.
- Importación/exportación CSV (solo utilidad básica, no migración).

### 5.2 Expedientes / proyectos
- CRUD con campos personalizados renderizados dinámicamente desde `custom_schema`.
- Vistas: tabla, Kanban por estado, ficha detallada.
- Cambio de estado registra evento en `case_events`.
- Código autonumérico por tipo (`EXP-2026-0001`, configurable).
- Panel lateral de historial (actividad, documentos, comunicaciones, tareas).

### 5.3 Tareas y plazos
- Vistas: lista, Kanban, calendario. Gantt en fase 4.
- Subtareas, checklist, asignación, prioridad, fecha de vencimiento.
- Avisos de vencimiento por notificación interna y email.
- "Mis tareas" y "Tareas del equipo".

### 5.4 Agenda
- Vistas día/semana/mes, multi-recurso con colores.
- Crear cita desde ficha de contacto o expediente.
- Detección de solapes por recurso.
- Estados de cita y marca de no-show.
- Recordatorios automáticos (ver 5.7).

### 5.5 Gestor documental y plantillas
- Subida a Supabase Storage con ruta `org/{org_id}/{entity}/{id}/{file}`.
- Versionado simple (nueva versión enlaza a la anterior).
- Previsualización de PDF e imágenes.
- Plantillas con variables: generar documento desde un expediente o contacto en un clic (HTML → PDF y/o DOCX).
- Descarga con URL firmada de corta duración.

### 5.6 Correo y mensajería
- Capa de abstracción `ChannelProvider` con interfaz común (`send`, `receive/webhook`, `status`). Adaptadores:
  - Email: SMTP/IMAP o API (Gmail/Microsoft Graph), a decidir.
  - WhatsApp: WhatsApp Business Cloud API (u otro proveedor intercambiable).
- Bandeja unificada por contacto y expediente.
- Envío en bloque con plantillas y variables.
- Registro de cada mensaje en `messages` vinculado a contacto/expediente.

### 5.7 Recordatorios automáticos
- Cola en `reminders` procesada por `pg_cron` + Edge Function.
- Reglas configurables: "24 h antes de la cita por WhatsApp", "3 días antes del vencimiento por email".
- Reintentos con backoff y registro de errores.

### 5.8 Control horario (fase 2)
- Fichar entrada/salida/pausa desde web y móvil (PWA).
- Parte diario y mensual por usuario, exportable.
- Vista de administrador por equipo.

### 5.9 Time report / rentabilidad (fase 2)
- Temporizador y registro manual de tiempo por expediente/tarea.
- Informe: horas reales vs `budget_hours`, por cliente, tipo y usuario.
- Marca de horas facturables (solo dato; sin facturación).

### 5.10 Cuadros de mando (fase 4)
- Widgets configurables: expedientes por estado, carga por usuario, ocupación de agenda, desviación de horas, tareas vencidas.
- Vistas materializadas o funciones SQL para rendimiento.
- Filtros por periodo, equipo y tipo.

### 5.11 Portal de cliente (fase 4)
- Acceso externo con rol restringido: ver sus expedientes, documentos compartidos, citas y mensajes.
- Autenticación por magic link.

### 5.12 Reserva online (fase 4)
- Página pública por recurso usando `availability_rules`.
- Confirmación por email/WhatsApp y alta automática del contacto.
- Protección anti-spam (captcha) y límite de reservas por IP.

### 5.13 Firma electrónica (fase 4)
- Interfaz `SignatureProvider` con adaptador a un proveedor externo (a decidir).
- Flujo: seleccionar documento → destinatarios → envío → webhook de estado → guardar PDF firmado en documentos.

### 5.14 Automatizaciones / RPA (fase 4)
- Motor sencillo `trigger → condiciones → acciones` (p. ej. "al pasar el expediente a *Cerrado*, enviar plantilla X y crear tarea Y").
- Acciones: crear tarea, enviar mensaje, cambiar estado, llamar webhook (n8n).
- Webhooks salientes firmados con HMAC.

---

## 6. Plan por fases

### Fase 0: Cimientos
- Proyecto Next.js + Supabase, auth, organizaciones, roles, RLS base, layout, sistema de diseño, CI.
- **Hecho cuando:** un usuario puede registrarse, crear una organización, invitar a otro y ambos ven solo datos de su organización (test e2e de aislamiento).

### Fase 1: MVP
Contactos, expedientes configurables, tareas, agenda, documentos con plantillas, ajustes de tipos de expediente, búsqueda global, historial y audit log.
- **Hecho cuando:** se puede configurar un tipo de expediente con campos y estados propios, crear un contacto con expedientes, tareas, cita y documento generado desde plantilla, y todo aparece en su ficha 360º.

### Fase 2: Comunicación y tiempo
Correo, WhatsApp, plantillas de mensaje, recordatorios, control horario y time report.
- **Hecho cuando:** una cita genera un recordatorio automático por el canal configurado, y existe un informe de horas reales vs presupuestadas por cliente.

### Fase 3: Pulido y rendimiento
Búsqueda avanzada, vistas guardadas, acciones en bloque, notificaciones, PWA, optimización de consultas, suite e2e ampliada.

### Fase 4: Extras
Cuadros de mando, portal de cliente, reserva online, firma electrónica, automatizaciones, Gantt.

---

## 7. Requisitos no funcionales

- **Rendimiento:** listados paginados en servidor (cursor o offset limitado), p95 < 500 ms en listados de hasta 100k registros.
- **Seguridad:** RLS siempre activa; `service_role` solo en servidor y funciones; secretos de canales cifrados (Supabase Vault); validación de entrada con Zod; cabeceras de seguridad en Next.
- **Observabilidad:** logging estructurado, captura de errores (Sentry o similar), métricas de colas de recordatorios.
- **Accesibilidad y UX:** teclado, contraste AA, estados vacíos y de carga cuidados, interfaz en español con i18n preparado.
- **Calidad:** lint + typecheck + tests en CI; migraciones reversibles cuando sea posible; datos semilla para desarrollo.
- **Copias de seguridad:** usar las de Supabase y documentar el procedimiento de restauración.

---

## 8. Instrucciones de trabajo para Claude Code

1. **Trabaja una fase cada vez** y no empieces la siguiente sin confirmación.
2. Antes de cada módulo: propón el plan de archivos y migraciones, espera validación y entonces implementa.
3. Cada migración debe incluir sus políticas RLS y sus índices. Nunca crear una tabla sin RLS.
4. Escribe tests para: aislamiento entre organizaciones, permisos por rol y los flujos críticos de cada fase.
5. Mantén la lógica de dominio en `/lib/modules`, no en los componentes.
6. Los proveedores externos (email, WhatsApp, firma) siempre detrás de interfaces; nada de llamadas directas desde la UI.
7. Todo texto de interfaz en español; el código, nombres de tablas y commits en inglés.
8. Commits pequeños con mensajes convencionales (`feat:`, `fix:`, `chore:`).
9. Si algo de esta especificación es ambiguo o choca con una decisión técnica mejor, **pregunta antes de improvisar** y anota la decisión en `docs/DECISIONS.md`.
10. Al terminar cada fase, actualiza `docs/CHANGELOG.md` con lo entregado y lo pendiente.

---

## 9. Decisiones abiertas

| Tema | Pendiente de decidir |
|---|---|
| Sector del primer cliente | Define tipos de expediente, campos y plantillas iniciales |
| Proveedor de correo | SMTP/IMAP vs Gmail API vs Microsoft Graph |
| Proveedor de WhatsApp | Cloud API oficial vs intermediario |
| Proveedor de firma electrónica | A elegir |
| Generación de DOCX/PDF | Librería y motor de plantillas |
| Nombre del producto y marca | Para UI y dominios |
