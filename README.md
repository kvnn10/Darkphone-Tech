# Darkphone Tech — Gestión integral

Aplicación web para la operación de una tienda de tecnología y servicio técnico, inspirada en los flujos visuales de Nexo Tech y con código propio.

## Stack
- Next.js App Router + TypeScript + React
- Supabase PostgreSQL y autenticación
- GitHub y Vercel

## Estado actual
- Estructura inicial Next.js y navegación por módulos.
- Panel consultando conteos básicos de Supabase cuando hay conexión.
- Inventario con búsqueda, alertas de mínimo y registro de artículos mediante Supabase.
- Esquema inicial SQL: perfiles, clientes, productos y seriales/IMEI, ventas y pagos divididos, caja, gastos, órdenes técnicas, garantías, movimientos y auditoría.
- Los módulos distintos a inventario son referencias visuales; faltan sus flujos de datos y transacciones.

**No está listo para producción** hasta que se configure Supabase, se implemente autenticación con roles, se prueben las políticas RLS y se completen las transacciones de ventas/caja/servicio.

## Configuración local
1. Instala Node.js 20.9 o posterior.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env.local`.
4. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con la URL del proyecto y la clave publicable/anon de Supabase.
5. En Supabase → SQL Editor, ejecuta `supabase/schema.sql`.
6. Ejecuta `npm run dev` y abre `http://localhost:3000`.

No compartas contraseñas ni tokens. Nunca publiques `.env.local` o la clave `service_role`; no la pongas en variables `NEXT_PUBLIC_*`.

## Vercel
Importa `kvnn10/Darkphone-Tech` desde https://vercel.com/new e incluye las dos variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Preview y Production. Cada push a `main` desplegará una actualización.

## Próximas etapas
1. Conectar la app a Supabase, crear perfil de propietario de forma segura y proteger rutas.
2. Completar clientes CRUD.
3. Crear funciones de base de datos transaccionales para ventas, pagos divididos y actualización atómica del inventario.
4. Conectar caja, gastos, servicio técnico, cartera, garantías y reportes.
5. Añadir pruebas, respaldo y verificación de seguridad antes de usar datos reales.
