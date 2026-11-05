# VetAgenda NoSQL

Proyecto final de Bases de Datos II (no relacionales). API REST sobre MongoDB para la gestión de una clínica veterinaria: clientes, mascotas, historial de vacunas, agenda de citas y reportes analíticos.

Instrucciones de instalación y ejecución: [Get Started](docs/GET_STARTED.md).

## Resumen

Funcionalidades:

- Registro de clientes y mascotas.
- Historial de vacunas embebido en cada mascota.
- Programación de citas con detección de cruces de horario por mascota y por veterinario.
- Consulta de citas por fecha, estado, cliente, mascota o veterinario.
- Filtrado de mascotas por especie, peso y próxima dosis de vacuna.
- Agenda diaria con citas y vacunas próximas.
- Reportes mediante aggregation pipeline: vacunas próximas y resumen mensual de citas e ingresos.

Stack: Node.js 22, Express 5, driver oficial `mongodb` 7, MongoDB 7, Docker Compose.

## Ejecución

### Con Docker

```bash
npm run docker:up
```

Equivale a `docker compose up --build`. Para detener: `npm run docker:down`.

Levanta MongoDB, aplica validadores e índices, carga el seed e inicia la API en `http://localhost:3000`.

### Sin Docker

Requiere MongoDB en ejecución, Node.js 22.9 o superior y npm 11.21.1 o superior.

```bash
cp .env.example .env
npm install
npm run setup
npm start
```

### Variables de entorno

Archivo `.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=veterinaria_nosql
```

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de la API |
| `MONGODB_URI` | Cadena de conexión a MongoDB |
| `MONGODB_DB` | Nombre de la base de datos |

## Documentación breve

### Justificación del modelo

MongoDB se adecua al caso por la combinación de subestructuras propias de una entidad (vacunas, dirección, veterinario) y entidades de crecimiento independiente (citas). El modelo de documentos permite recuperar una mascota con su historial de vacunas en una sola lectura; las referencias evitan duplicar datos de contacto.

### Decisiones de diseño

| Colección | Estructura | Justificación |
|---|---|---|
| `clientes` | `direccion` embebida. Referenciado desde `mascotas` y `citas` | Un cliente posee varias mascotas; duplicar sus datos de contacto implicaría actualizaciones en múltiples documentos. La dirección solo se consulta junto al cliente |
| `mascotas` | `vacunas` embebidas. `cliente_id` referenciado | Las vacunas forman parte del historial de la mascota, se leen con ella, tienen estructura pequeña y estable, y no se consultan de forma aislada |
| `citas` | `veterinario` embebido como snapshot. `mascota_id` y `cliente_id` referenciados | Es la colección de mayor crecimiento y se consulta por fecha, estado, mascota y veterinario, por lo que requiere colección e índices propios. El snapshot conserva el dato histórico sin una cuarta colección |

### Validación `$jsonSchema`

`scripts/init-db.js` crea las colecciones con `validationLevel: strict` y `validationAction: error`.

- `clientes`: nombre, apellido, correo con formato válido, teléfono, dirección, estado y fecha de creación.
- `mascotas`: `cliente_id` como `ObjectId`, especie y sexo dentro de una lista cerrada, peso mayor que 0 y vacunas con fechas válidas.
- `citas`: código, referencias `ObjectId`, duración entre 15 y 180 minutos, estado permitido, veterinario y costo no negativo.

### Índices

| Colección | Índice | Motivo |
|---|---|---|
| `clientes` | `email` (único) | Unicidad de correo |
| `clientes` | `direccion.ciudad`, `activo` | Filtro por ciudad y estado |
| `mascotas` | `cliente_id`, `activo` | Mascotas por propietario |
| `mascotas` | `especie`, `peso_kg` | Filtros combinados |
| `mascotas` | `vacunas.proxima_dosis` | Recordatorios de vacunación |
| `citas` | `codigo` (único) | Identificador de la cita |
| `citas` | `fecha_hora`, `estado` | Agenda diaria y rangos de fecha |
| `citas` | `mascota_id`, `fecha_hora` | Historial y detección de cruces |
| `citas` | `cliente_id`, `fecha_hora` | Historial del cliente |
| `citas` | `veterinario.id`, `fecha_hora` | Agenda del veterinario y detección de cruces |

### Consultas

Los listados admiten operadores de comparación (`$gte`, `$lte`), lógicos (`$or`, `$in`, `$nin`), búsqueda por texto (`$regex`, con escape de caracteres especiales), filtros sobre subdocumentos (`direccion.ciudad`) y arreglos (`$elemMatch` sobre `vacunas`), junto con paginación (`page`, `limit`) y ordenamiento (`sort`).

### Aggregation pipeline

`GET /api/reportes/vacunas-proximas`: `$unwind` → `$match` → `$lookup` → `$group` → `$project` → `$sort`. Agrupa por especie y vacuna, con total de mascotas y fecha más cercana.

`GET /api/reportes/citas-mensuales`: agrupa por año y mes; devuelve cantidad de citas, ingresos y ticket promedio.

### Regla de negocio

Al crear una cita se buscan citas activas de la misma mascota o del mismo veterinario cercanas a la fecha solicitada y se comparan los intervalos (`fecha_hora` y `duracion_min`). Ante un solapamiento se responde `409 Conflict` y no se inserta el documento.

## Endpoints

| Recurso | Método y ruta |
|---|---|
| Clientes | `POST /api/clientes` |
| | `GET /api/clientes?page=1&limit=10&ciudad=Santa%20Tecla&q=ana&sort=nombre` |
| | `GET /api/clientes/:id` |
| Mascotas | `POST /api/mascotas` |
| | `GET /api/mascotas?especie=Perro&peso_min=5&vacuna_antes=2026-12-31&sort=-peso_kg` |
| | `GET /api/mascotas/:id` |
| | `PATCH /api/mascotas/:id` |
| | `POST /api/mascotas/:id/vacunas` |
| Citas | `POST /api/citas` |
| | `GET /api/citas?desde=2026-10-01&hasta=2026-10-31&estado=confirmada&sort=fecha_hora` |
| | `PATCH /api/citas/:id/estado` |
| | `GET /api/citas/agenda/dia?fecha=2026-10-15&dias_vacunas=7` |
| Reportes | `GET /api/reportes/vacunas-proximas?dias=30` |
| | `GET /api/reportes/citas-mensuales` |

## Datos de prueba

`scripts/seed.js` genera datos ficticios reproducibles: 60 clientes, 80 mascotas y 100 citas, con vacunas en distintas fechas y citas distribuidas en varios meses, estados y veterinarios.

## Pruebas de la API

- Colección de Postman: [postman/](postman/README.md)
- Especificación OpenAPI: [docs/openapi.yaml](docs/openapi.yaml)

## Estructura del repositorio

```
src/        API: aplicación, conexión, rutas y utilidades
scripts/    init-db.js (validadores e índices) y seed.js
docs/       Get Started y OpenAPI
postman/    Colección de Postman y su documentación
Dockerfile
docker-compose.yml
```

## Equipo

- Diego Fernando Duran Figueroa
- Juan David Molina Ruano
- Roberto Enrique Escobar Henriquez
