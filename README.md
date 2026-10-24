# Darkphone Tech — Gestión integral

Aplicación de gestión para una tienda de tecnología y servicio técnico, inspirada en los flujos de Nexo Tech y construida con código propio.

## Stack
- Next.js App Router, React y TypeScript
- Supabase (PostgreSQL y Auth)
- GitHub para control de versiones
- Vercel para despliegues

## Estado
Esta es la estructura inicial del proyecto. La interfaz de panel e inventario se está desarrollando. Antes de usarlo con operaciones reales deben configurarse Supabase, autenticación, roles y permisos, y probarse los flujos transaccionales de inventario, ventas, caja y servicio técnico.

## Configuración local
1. Instala Node.js 20.9 o superior.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env.local`.
4. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores de tu proyecto Supabase.
5. Ejecuta `supabase/schema.sql` desde Supabase SQL Editor.
6. Ejecuta `npm run dev`.

No subas `.env.local` ni claves secretas a GitHub. Nunca uses una clave `service_role` en el navegador o en variables `NEXT_PUBLIC_*`.

## Módulos planeados
Inventario con seriales/IMEI, ventas con pagos divididos, clientes, caja, gastos, cuentas por cobrar, servicio técnico, garantías, reportes, usuarios y asistente.

## Próximo paso
Agregar la aplicación Next.js inicial, conectar Supabase y desplegar una vista previa en Vercel. El sistema no debe considerarse listo para producción hasta completar autenticación y pruebas de seguridad.