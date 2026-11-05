require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'veterinaria_nosql';

function pick(arr, i) { return arr[i % arr.length]; }
function addDays(date, days) { return new Date(date.getTime() + days * 86400000); }

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await Promise.all(['citas', 'mascotas', 'clientes'].map(c => db.collection(c).deleteMany({})));

  const nombres = ['Ana', 'Carlos', 'María', 'José', 'Sofía', 'Diego', 'Valeria', 'Luis', 'Gabriela', 'Fernando'];
  const apellidos = ['Martínez', 'López', 'Hernández', 'García', 'Ramírez', 'Díaz', 'Flores', 'Rivera', 'Méndez', 'Castro'];
  const ciudades = ['Santa Tecla', 'San Salvador', 'Antiguo Cuscatlán', 'Soyapango', 'Mejicanos'];
  const clientes = Array.from({ length: 60 }, (_, i) => ({
    _id: new ObjectId(),
    nombre: pick(nombres, i),
    apellido: pick(apellidos, i * 3 + 1),
    email: `cliente${String(i + 1).padStart(2, '0')}@correo.test`,
    telefono: `7${String(1000000 + i * 137).slice(-7)}`,
    direccion: { ciudad: pick(ciudades, i), colonia: `Colonia ${1 + (i % 12)}`, detalle: `Calle ${1 + (i % 8)}, casa ${10 + i}` },
    activo: i % 17 !== 0,
    creado_en: addDays(new Date('2026-01-01T14:00:00Z'), i)
  }));
  await db.collection('clientes').insertMany(clientes);

  const especies = ['Perro', 'Gato', 'Perro', 'Gato', 'Conejo', 'Ave'];
  const nombresMascota = ['Luna', 'Max', 'Milo', 'Nala', 'Toby', 'Kira', 'Rocky', 'Maya', 'Simba', 'Coco'];
  const vacunasPorEspecie = {
    Perro: ['Rabia', 'Quíntuple', 'Bordetella'],
    Gato: ['Rabia', 'Triple felina', 'Leucemia felina'],
    Conejo: ['Mixomatosis', 'Enfermedad hemorrágica'],
    Ave: ['Newcastle', 'Viruela aviar']
  };
  const mascotas = Array.from({ length: 80 }, (_, i) => {
    const especie = pick(especies, i);
    const base = new Date('2026-10-31T12:00:00Z');
    const vacunas = vacunasPorEspecie[especie].slice(0, 2).map((nombre, j) => ({
      nombre,
      fecha_aplicacion: addDays(base, -150 - ((i + j) % 120)),
      proxima_dosis: addDays(base, -10 + ((i * 7 + j * 13) % 120)),
      lote: `L-${especie.slice(0, 2).toUpperCase()}-${1000 + i * 3 + j}`,
      veterinario: pick(['Dra. Elena Rivas', 'Dr. Mario Campos', 'Dra. Paula León'], i + j)
    }));
    return {
      _id: new ObjectId(),
      cliente_id: clientes[i % clientes.length]._id,
      nombre: `${pick(nombresMascota, i)} ${i + 1}`,
      especie,
      raza: especie === 'Perro' ? pick(['Mestizo', 'Labrador', 'Poodle', 'Husky'], i) : especie === 'Gato' ? pick(['Mestizo', 'Siamés', 'Persa'], i) : 'Mestizo',
      sexo: i % 2 === 0 ? 'Macho' : 'Hembra',
      fecha_nacimiento: addDays(new Date('2024-01-01T12:00:00Z'), -(i % 1000)),
      peso_kg: Number((1.2 + ((i * 1.37) % 28)).toFixed(1)),
      alergias: i % 9 === 0 ? ['Pollo'] : i % 13 === 0 ? ['Penicilina'] : [],
      vacunas,
      activo: i % 29 !== 0,
      creado_en: addDays(new Date('2026-02-01T14:00:00Z'), i)
    };
  });
  await db.collection('mascotas').insertMany(mascotas);

  const vets = [
    { id: 'VET-001', nombre: 'Dra. Elena Rivas', especialidad: 'Medicina general' },
    { id: 'VET-002', nombre: 'Dr. Mario Campos', especialidad: 'Cirugía' },
    { id: 'VET-003', nombre: 'Dra. Paula León', especialidad: 'Dermatología' },
    { id: 'VET-004', nombre: 'Dr. Andrés Molina', especialidad: 'Animales exóticos' }
  ];
  const estados = ['programada', 'confirmada', 'completada', 'completada', 'completada', 'cancelada', 'no_asistio'];
  const motivos = ['Consulta general', 'Vacunación', 'Control de peso', 'Problema digestivo', 'Revisión de piel', 'Control postoperatorio'];
  const citas = Array.from({ length: 100 }, (_, i) => {
    const mascota = mascotas[i % mascotas.length];
    const monthOffset = Math.floor(i / 20) - 2;
    const date = new Date(Date.UTC(2026, 9 + monthOffset, 2 + (i % 20), 14 + (i % 5), (i % 2) * 30));
    return {
      _id: new ObjectId(),
      codigo: `CITA-${String(i + 1).padStart(5, '0')}`,
      mascota_id: mascota._id,
      cliente_id: mascota.cliente_id,
      fecha_hora: date,
      duracion_min: pick([30, 30, 45, 60], i),
      estado: pick(estados, i),
      motivo: pick(motivos, i),
      veterinario: pick(vets, i),
      notas: i % 5 === 0 ? 'Dar seguimiento en próxima visita.' : '',
      costo: Number((18 + (i % 8) * 6.5).toFixed(2)),
      creado_en: addDays(date, -10)
    };
  });
  await db.collection('citas').insertMany(citas);

  console.log('Seed completado: 60 clientes, 80 mascotas y 100 citas.');
  await client.close();
}

main().catch(error => { console.error(error); process.exit(1); });
