# Contact ETL CRM

Aplicacion web para centralizar archivos de contactos, limpiarlos, transformarlos con reglas ETL, consolidarlos sin duplicados y analizarlos en un dashboard.

## Stack

- Frontend: Next.js + React + Tailwind
- Backend y datos: Supabase PostgreSQL, Auth, Storage y Edge Functions
- Deploy: Vercel
- Versionado: GitHub

## Funcionalidades incluidas

- Dashboard operativo con metricas de contactos, fuentes y crecimiento.
- Flujo de importacion: upload, metadata, mapping, ETL, preview e importacion.
- Motor ETL en TypeScript con limpieza, reemplazos, split, concat, normalizacion de email, filtros y dedupe.
- API de preview: `POST /api/etl/preview`.
- API de importacion: `POST /api/import`, con upsert por email y trazabilidad en `contact_sources`.
- Esquema Supabase en `supabase/schema.sql`.
- Edge Function inicial en `supabase/functions/process-etl`.

## Puesta en marcha local

1. Instalar dependencias:

```bash
npm install
```

2. Crear variables de entorno:

```bash
cp .env.example .env.local
```

3. Completar:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

4. Ejecutar:

```bash
npm run dev
```

5. Abrir:

```bash
http://localhost:3000
```

## Configuracion de Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar el SQL de `supabase/schema.sql` en el SQL Editor.
3. Crear un bucket de Storage para archivos crudos, por ejemplo `contact-uploads`.
4. Activar Auth con email/password o proveedor OAuth.
5. Copiar las claves del proyecto a `.env.local`.

## Modelo de datos principal

- `uploads`: archivo crudo, metadata, usuario, fuente, tipo de base y estado.
- `mapping_templates`: templates reutilizables para mapear columnas de archivos a campos estandar.
- `etl_pipelines`: pipelines versionables con secuencia de pasos y clave de deduplicacion.
- `etl_runs`: historial de previews/importaciones, conteos, errores y resultado parcial.
- `contacts`: base maestra, con email unico como primary key logica.
- `contact_sources`: trazabilidad entre contacto, archivo origen y filas originales/procesadas.

## Estrategia de importacion

1. Subir archivo a Supabase Storage.
2. Registrar metadata en `uploads`.
3. Parsear CSV/Excel.
4. Mapear columnas a campos estandar.
5. Ejecutar pipeline ETL.
6. Mostrar preview.
7. Confirmar importacion.
8. Hacer upsert en `contacts` por `email`.
9. Guardar trazabilidad en `contact_sources`.

## Deploy

1. Subir el repositorio a GitHub.
2. Crear proyecto en Vercel desde ese repositorio.
3. Cargar las variables de entorno en Vercel.
4. Conectar Supabase y verificar que `SUPABASE_SERVICE_ROLE_KEY` solo exista del lado servidor.

## Proximos pasos recomendados

- Conectar el upload real a Supabase Storage.
- Agregar parser real para CSV/XLSX desde el archivo elegido.
- Convertir el builder ETL en editor editable y persistir pipelines.
- Agregar login con Supabase Auth.
- Mover importaciones grandes a Edge Functions o jobs por lotes.
- Sumar tests para transformaciones ETL y upsert.
