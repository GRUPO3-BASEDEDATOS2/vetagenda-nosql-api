# Colección de Postman

Archivo: [VetAgenda.postman_collection.json](VetAgenda.postman_collection.json)

Cubre los endpoints de VetAgenda NoSQL. Requiere la API en ejecución ([Get Started](../docs/GET_STARTED.md)).

## Importación

1. En Postman, **Import** y selección de `VetAgenda.postman_collection.json`.
2. En la colección **VetAgenda NoSQL API**, pestaña **Variables**, definir los valores indicados abajo.

## Variables

| Variable | Valor inicial | Descripción |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | Dirección de la API |
| `clienteId` | `REEMPLAZAR_CON_ID_CLIENTE` | `_id` de un cliente existente |
| `mascotaId` | `REEMPLAZAR_CON_ID_MASCOTA` | `_id` de una mascota activa existente |
| `citaId` | `REEMPLAZAR_CON_ID_CITA` | `_id` de una cita existente |

Los `_id` se regeneran con cada carga del seed. Se obtienen de las respuestas de los listados. Las peticiones de lectura y los reportes no requieren estas variables.

## Peticiones

### Salud

| Petición | Método y ruta | Verifica |
|---|---|---|
| Health | `GET /health` | Disponibilidad de la API |

### Clientes

| Petición | Método y ruta | Verifica |
|---|---|---|
| Listar clientes | `GET /api/clientes?page=1&limit=10&ciudad=Santa Tecla&sort=nombre` | Filtro por subdocumento, paginación y orden |
| Crear cliente | `POST /api/clientes` | Escritura con subdocumento `direccion`, `$jsonSchema` y correo único |
| Obtener cliente | `GET /api/clientes/{{clienteId}}` | Lectura por `_id` |

### Mascotas

| Petición | Método y ruta | Verifica |
|---|---|---|
| Listar mascotas con filtro avanzado | `GET /api/mascotas?especie=Perro&peso_min=5&vacuna_antes=2026-12-31&sort=-peso_kg` | `$gte` y `$elemMatch` sobre vacunas |
| Crear mascota | `POST /api/mascotas` | Escritura referenciada a `{{clienteId}}` (cliente existente y activo) |
| Agregar vacuna | `POST /api/mascotas/{{mascotaId}}/vacunas` | Actualización del arreglo embebido con `$push` |
| Obtener mascota con propietario | `GET /api/mascotas/{{mascotaId}}` | `$lookup` hacia `clientes` |

### Citas

| Petición | Método y ruta | Verifica |
|---|---|---|
| Listar agenda filtrada | `GET /api/citas?desde=2026-10-01&hasta=2026-11-30&sort=fecha_hora` | Rango de fechas, paginación y orden |
| Crear cita (valida conflicto) | `POST /api/citas` | `409` ante cruce de horario de mascota o veterinario |
| Cambiar estado de cita | `PATCH /api/citas/{{citaId}}/estado` | Estados: `programada`, `confirmada`, `completada`, `cancelada`, `no_asistio` |
| Agenda del día y vacunas próximas | `GET /api/citas/agenda/dia?fecha=2026-10-31&dias_vacunas=14` | Citas del día y vacunas por vencer en una respuesta |

### Reportes

| Petición | Método y ruta | Verifica |
|---|---|---|
| Reporte de vacunas próximas | `GET /api/reportes/vacunas-proximas?dias=90` | `$unwind`, `$match`, `$lookup`, `$group`, `$project`, `$sort` |
| Reporte mensual de citas e ingresos | `GET /api/reportes/citas-mensuales` | Cantidad, ingresos y ticket promedio por año y mes |

## Verificación de la regla de conflicto

1. Asignar a `mascotaId` el `_id` de una mascota activa.
2. Ejecutar **Crear cita (valida conflicto)**: respuesta `201`.
3. Repetir la petición sin modificar el cuerpo: respuesta `409 Conflict` con el código de la cita en conflicto.

## Observaciones

- `PATCH /api/mascotas/:id` no está incluido en la colección. Se documenta en el [README principal](../README.md#endpoints).
- Repetir **Crear cliente** con el mismo `email` produce `409` por correo duplicado.
- Reiniciar con Docker recarga el seed e invalida los `_id` copiados.
