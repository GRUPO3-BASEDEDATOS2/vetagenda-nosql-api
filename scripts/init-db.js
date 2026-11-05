require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'veterinaria_nosql';

const validators = {
  clientes: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['nombre', 'apellido', 'email', 'telefono', 'direccion', 'activo', 'creado_en'],
      properties: {
        nombre: { bsonType: 'string', minLength: 2 },
        apellido: { bsonType: 'string', minLength: 2 },
        email: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
        telefono: { bsonType: 'string', minLength: 8 },
        direccion: {
          bsonType: 'object',
          required: ['ciudad', 'detalle'],
          properties: {
            ciudad: { bsonType: 'string' },
            colonia: { bsonType: 'string' },
            detalle: { bsonType: 'string' }
          }
        },
        activo: { bsonType: 'bool' },
        creado_en: { bsonType: 'date' }
      }
    }
  },
  mascotas: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['cliente_id', 'nombre', 'especie', 'sexo', 'fecha_nacimiento', 'peso_kg', 'vacunas', 'activo', 'creado_en'],
      properties: {
        cliente_id: { bsonType: 'objectId' },
        nombre: { bsonType: 'string', minLength: 1 },
        especie: { enum: ['Perro', 'Gato', 'Conejo', 'Ave', 'Otro'] },
        raza: { bsonType: 'string' },
        sexo: { enum: ['Macho', 'Hembra'] },
        fecha_nacimiento: { bsonType: 'date' },
        peso_kg: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0.1 },
        alergias: { bsonType: 'array', items: { bsonType: 'string' } },
        vacunas: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['nombre', 'fecha_aplicacion', 'proxima_dosis', 'lote', 'veterinario'],
            properties: {
              nombre: { bsonType: 'string' },
              fecha_aplicacion: { bsonType: 'date' },
              proxima_dosis: { bsonType: 'date' },
              lote: { bsonType: 'string' },
              veterinario: { bsonType: 'string' }
            }
          }
        },
        activo: { bsonType: 'bool' },
        creado_en: { bsonType: 'date' }
      }
    }
  },
  citas: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['codigo', 'mascota_id', 'cliente_id', 'fecha_hora', 'duracion_min', 'estado', 'motivo', 'veterinario', 'costo', 'creado_en'],
      properties: {
        codigo: { bsonType: 'string' },
        mascota_id: { bsonType: 'objectId' },
        cliente_id: { bsonType: 'objectId' },
        fecha_hora: { bsonType: 'date' },
        duracion_min: { bsonType: ['int', 'long', 'double'], minimum: 15, maximum: 180 },
        estado: { enum: ['programada', 'confirmada', 'completada', 'cancelada', 'no_asistio'] },
        motivo: { bsonType: 'string' },
        veterinario: {
          bsonType: 'object',
          required: ['id', 'nombre', 'especialidad'],
          properties: {
            id: { bsonType: 'string' },
            nombre: { bsonType: 'string' },
            especialidad: { bsonType: 'string' }
          }
        },
        notas: { bsonType: 'string' },
        costo: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 },
        creado_en: { bsonType: 'date' }
      }
    }
  }
};

async function ensureCollection(db, name, validator) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) {
    await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
  } else {
    await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
  }
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  for (const [name, validator] of Object.entries(validators)) await ensureCollection(db, name, validator);

  await db.collection('clientes').createIndex({ email: 1 }, { unique: true });
  await db.collection('clientes').createIndex({ 'direccion.ciudad': 1, activo: 1 });
  await db.collection('mascotas').createIndex({ cliente_id: 1, activo: 1 });
  await db.collection('mascotas').createIndex({ especie: 1, peso_kg: 1 });
  await db.collection('mascotas').createIndex({ 'vacunas.proxima_dosis': 1 });
  await db.collection('citas').createIndex({ codigo: 1 }, { unique: true });
  await db.collection('citas').createIndex({ fecha_hora: 1, estado: 1 });
  await db.collection('citas').createIndex({ mascota_id: 1, fecha_hora: 1 });
  await db.collection('citas').createIndex({ cliente_id: 1, fecha_hora: 1 });
  await db.collection('citas').createIndex({ 'veterinario.id': 1, fecha_hora: 1 });

  console.log(`Base ${dbName} inicializada con validadores e índices.`);
  await client.close();
}

main().catch(error => { console.error(error); process.exit(1); });
