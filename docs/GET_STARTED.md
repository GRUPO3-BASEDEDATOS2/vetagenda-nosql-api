# Get Started

Instrucciones para ejecutar y probar VetAgenda NoSQL.

## 1. Requisitos

| Herramienta | Versión | Observación |
|---|---|---|
| Docker Desktop | Reciente | Opción A |
| Node.js | 22.9 o superior | Opción B |
| npm | 11.21.1 o superior | Opción B. `npm i -g npm@11.21.1`. Exigido por `engine-strict`, dado que `.npmrc` emplea opciones que versiones anteriores ignoran |
| MongoDB | 7 o superior | Opción B |
| Postman | Cualquiera | Pruebas de la API |

## 2. Variables de entorno

Definidas en `.env`, a partir de `.env.example`. En la Opción A las inyecta `docker-compose.yml`.

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto de la API |
| `MONGODB_URI` | `mongodb://localhost:27017` | Cadena de conexión a MongoDB |
| `MONGODB_DB` | `veterinaria_nosql` | Nombre de la base de datos |

## 3. Opción A: Docker

```bash
docker compose up --build
```

Servicios, en orden de arranque:

1. `mongo`: MongoDB 7, expuesto únicamente en `127.0.0.1:27017`.
2. `setup`: crea colecciones con `$jsonSchema`, índices y carga el seed. Finaliza al terminar.
3. `api`: inicia tras la finalización correcta de `setup`, en `http://localhost:3000`.

El seed elimina y recrea los datos de las tres colecciones en cada ejecución de `docker compose up`.

Detención: `docker compose down`. La opción `-v` elimina además el volumen de datos.

## 4. Opción B: ejecución local

Requiere una instancia de MongoDB en ejecución.

```bash
cp .env.example .env
npm install
npm run setup
npm start
```

| Script | Descripción |
|---|---|
| `npm start` | Inicia la API |
| `npm run dev` | Inicia la API con recarga automática |
| `npm run db:init` | Crea colecciones, `$jsonSchema` e índices |
| `npm run seed` | Carga 60 clientes, 80 mascotas y 100 citas |
| `npm run setup` | Ejecuta `db:init` y `seed` |
| `npm run check` | Verifica la sintaxis de los archivos |

## 5. Verificación

```bash
curl http://localhost:3000/health
```

Respuesta esperada: `{"ok":true,"servicio":"VetAgenda NoSQL API"}`.

## 6. Pruebas de la API

La colección de Postman y su descripción se encuentran en [postman/](../postman/README.md). La especificación OpenAPI está en [openapi.yaml](openapi.yaml).

Secuencia de verificación:

1. Volumen de datos: `GET /api/clientes?limit=5`, `GET /api/mascotas?limit=5`, `GET /api/citas?limit=5`.
2. Filtro avanzado: `GET /api/mascotas?especie=Perro&peso_min=5&vacuna_antes=2026-12-31&sort=-peso_kg`.
3. Agenda integrada: `GET /api/citas/agenda/dia?fecha=2026-10-31&dias_vacunas=14`.
4. Reporte con aggregation: `GET /api/reportes/vacunas-proximas?dias=90`.
5. Reporte mensual: `GET /api/reportes/citas-mensuales`.
6. Regla de conflicto: dos envíos idénticos de `POST /api/citas`; el segundo responde `409 Conflict`.

Ejemplo de cuerpo para `POST /api/citas`:

```json
{
  "mascota_id": "<_id de una mascota activa>",
  "fecha_hora": "2026-11-20T15:00:00Z",
  "duracion_min": 30,
  "motivo": "Consulta general",
  "veterinario": { "id": "VET-001", "nombre": "Dra. Elena Rivas", "especialidad": "Medicina general" },
  "costo": 25
}
```

## 7. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Unsupported engine` al instalar | npm desactualizado. Ejecutar `npm i -g npm@11.21.1` |
| `npm install` no resuelve una versión | `.npmrc` exige una antigüedad mínima de 1 día por versión (`min-release-age=1`) |
| `No fue posible conectar con MongoDB` | MongoDB no está en ejecución o `MONGODB_URI` es incorrecta |
| Los datos creados desaparecen | El seed reemplaza los datos en cada `docker compose up` y `npm run setup` |
| Error `400` por `$jsonSchema` | El documento incumple las reglas de validación de la colección |
