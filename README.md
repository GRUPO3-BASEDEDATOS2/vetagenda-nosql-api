# VetAgenda NoSQL

Proyecto final de Bases de Datos II: API REST para una veterinaria con agenda de citas, control de vacunas y reportes sobre MongoDB.

## 1. Qué resuelve

El sistema permite:
- Registrar clientes y mascotas.
- Mantener el historial de vacunas dentro de cada mascota.
- Programar citas y bloquear cruces de horario para la misma mascota o veterinario.
- Consultar la agenda por fecha, estado, cliente, mascota o veterinario.
- Filtrar mascotas por especie, peso y próxima dosis de vacuna.
- Mostrar una agenda diaria que mezcla citas y vacunas próximas.
- Generar reportes por aggregation pipeline: vacunas próximas y resumen mensual de citas/ingresos.

## 2. Modelo NoSQL

Colecciones principales:
1. `clientes`
2. `mascotas`
3. `citas`

La base usa `$jsonSchema` en las tres colecciones. Las vacunas se embeben en `mascotas`; las relaciones cliente-mascota y cita-mascota/cliente se manejan con referencias `ObjectId`.

## 3. Requisitos

- Node.js 22.9+ y npm 11.21.1+ (`npm i -g npm@11.21.1`)
- MongoDB 7+ o Docker Desktop

## 4. Inicio rápido con MongoDB local

```bash
cp .env.example .env
npm install
npm run setup
npm start
```

La API quedará en `http://localhost:3000`.

## 5. Inicio con Docker

```bash
docker compose up --build
```

El `docker-compose.yml` espera a que MongoDB esté saludable, ejecuta automáticamente validadores + seed y después inicia la API.

## 6. Datos de prueba

`npm run seed` crea datos ficticios reproducibles:
- 60 clientes
- 80 mascotas
- 100 citas

Así se cumple el volumen mínimo solicitado para probar filtros y agregaciones.

## 7. Endpoints principales

### Clientes
- `POST /api/clientes`
- `GET /api/clientes?page=1&limit=10&ciudad=Santa%20Tecla&q=ana&sort=nombre`
- `GET /api/clientes/:id`

### Mascotas
- `POST /api/mascotas`
- `GET /api/mascotas?especie=Perro&peso_min=5&vacuna_antes=2026-12-31&sort=-peso_kg`
- `GET /api/mascotas/:id`
- `PATCH /api/mascotas/:id`
- `POST /api/mascotas/:id/vacunas`

### Citas
- `POST /api/citas`
- `GET /api/citas?desde=2026-10-01&hasta=2026-10-31&estado=confirmada&sort=fecha_hora`
- `PATCH /api/citas/:id/estado`
- `GET /api/citas/agenda/dia?fecha=2026-10-31&dias_vacunas=7`

### Reportes
- `GET /api/reportes/vacunas-proximas?dias=30`
- `GET /api/reportes/citas-mensuales`

## 8. Lógica de negocio relevante

Al crear una cita, la API busca citas activas del mismo veterinario o de la misma mascota alrededor de la fecha solicitada y compara intervalos según `duracion_min`. Si existe cruce, responde `409 Conflict` y no inserta la cita.

La agenda diaria combina:
- citas del día ordenadas por hora;
- vacunas cuya próxima dosis cae dentro de una ventana configurable.

## 9. Consultas avanzadas

Se utilizan filtros con `$gte`, `$lte`, `$elemMatch`, `$regex`, `$or`, `$in` y `$nin`, además de paginación y ordenamiento.

El reporte de vacunas próximas usa una aggregation pipeline con:
- `$unwind`
- `$match`
- `$lookup`
- `$group`
- `$project`
- `$sort`

## 10. Pruebas

Importe `docs/VetAgenda.postman_collection.json` en Postman (la especificación OpenAPI está en `docs/openapi.yaml`). Las peticiones de lectura y reportes funcionan después de ejecutar `npm run setup`.

Para crear citas o vacunas nuevas, copie un `_id` real de las respuestas de clientes/mascotas y colóquelo en las variables de la colección de Postman.
