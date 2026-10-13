# Decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-13 | Next.js 16.4 (última estable) en lugar de 15 | La spec dice 15; se usa la última estable. Leer `node_modules/next/dist/docs/` antes de codificar. |
| 2026-10-13 | Supabase y Vercel se configuran más adelante | Decisión del usuario: primero avanzar el código; la carpeta `supabase/` y el despliegue llegan después. |
| 2026-10-13 | La organización activa se obtiene de `memberships` (función `current_org_id()`), no del JWT `app_metadata` | Evita configurar un hook de auth; los cambios de rol/organización se aplican al instante. La RLS es equivalente. |
| 2026-10-13 | Un usuario pertenece a una sola organización (`memberships.user_id` único) | Decisión de diseño inicial; ampliar a multi-organización exigiría cambiar la migración base. |
| 2026-10-13 | Next 16 con `cacheComponents`: el acceso a cookies/searchParams va dentro de `<Suspense>` | Requerido por el prerender; el build falla si no. |
