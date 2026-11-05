const express = require('express');
const { getDb } = require('../db');
const { pagination, parseSort, objectId, str, badRequest, dateOrError } = require('../utils/http');

const ESTADOS = ['programada', 'confirmada', 'completada', 'cancelada', 'no_asistio'];

const router = express.Router();

function overlaps(startA, minutesA, startB, minutesB) {
  const endA = new Date(startA.getTime() + minutesA * 60000);
  const endB = new Date(startB.getTime() + minutesB * 60000);
  return startA < endB && startB < endA;
}

async function findConflict(db, { mascotaId, veterinarioId, fechaHora, duracionMin, excludeId }) {
  const dayBefore = new Date(fechaHora.getTime() - 24 * 60 * 60000);
  const dayAfter = new Date(fechaHora.getTime() + 24 * 60 * 60000);
  const filter = {
    estado: { $nin: ['cancelada', 'no_asistio'] },
    fecha_hora: { $gte: dayBefore, $lte: dayAfter },
    $or: [
      { mascota_id: mascotaId },
      { 'veterinario.id': veterinarioId }
    ]
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const candidates = await db.collection('citas').find(filter).toArray();
  return candidates.find(c => overlaps(fechaHora, duracionMin, c.fecha_hora, c.duracion_min));
}

router.post('/', async (req, res, next) => {
  try {
    const db = getDb();
    const mascotaId = objectId(req.body.mascota_id, 'mascota_id');
    const mascota = await db.collection('mascotas').findOne({ _id: mascotaId, activo: true });
    if (!mascota) return res.status(400).json({ error: 'La mascota indicada no existe o está inactiva' });

    const fechaHora = dateOrError(req.body.fecha_hora, 'fecha_hora');
    const duracionMin = Number(req.body.duracion_min || 30);
    const veterinario = req.body.veterinario;
    if (!veterinario || typeof veterinario !== 'object' || typeof veterinario.id !== 'string' || typeof veterinario.nombre !== 'string') {
      throw badRequest('veterinario debe ser un objeto con id y nombre (y opcionalmente especialidad)');
    }
    if (!Number.isFinite(duracionMin)) throw badRequest('duracion_min debe ser numérico');
    const conflict = await findConflict(db, {
      mascotaId,
      veterinarioId: veterinario.id,
      fechaHora,
      duracionMin
    });
    if (conflict) {
      return res.status(409).json({
        error: 'Conflicto de agenda',
        detalle: 'La mascota o el veterinario ya tiene una cita que se cruza con ese horario',
        cita_conflictiva: conflict.codigo
      });
    }

    const doc = {
      mascota_id: mascotaId,
      cliente_id: mascota.cliente_id,
      fecha_hora: fechaHora,
      duracion_min: duracionMin,
      estado: req.body.estado || 'programada',
      motivo: req.body.motivo,
      veterinario: {
        id: veterinario.id,
        nombre: veterinario.nombre,
        especialidad: veterinario.especialidad || 'Medicina general'
      },
      notas: req.body.notas || '',
      costo: Number(req.body.costo || 0),
      creado_en: new Date()
    };
    // El código sale del último existente; si dos peticiones chocan, el índice único lo rechaza y se reintenta.
    for (let intento = 0; ; intento++) {
      const ultima = await db.collection('citas').find({}, { projection: { codigo: 1 } }).sort({ codigo: -1 }).limit(1).next();
      const sequence = (ultima ? Number(ultima.codigo.split('-')[1]) : 0) + 1;
      doc.codigo = `CITA-${String(sequence).padStart(5, '0')}`;
      try {
        const result = await db.collection('citas').insertOne(doc);
        return res.status(201).json({ _id: result.insertedId, ...doc });
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.codigo && intento < 5) continue;
        throw error;
      }
    }
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.query.estado) filter.estado = str(req.query.estado, 'estado');
    if (req.query.veterinario_id) filter['veterinario.id'] = str(req.query.veterinario_id, 'veterinario_id');
    if (req.query.cliente_id) filter.cliente_id = objectId(req.query.cliente_id, 'cliente_id');
    if (req.query.mascota_id) filter.mascota_id = objectId(req.query.mascota_id, 'mascota_id');
    if (req.query.desde || req.query.hasta) {
      filter.fecha_hora = {};
      if (req.query.desde) filter.fecha_hora.$gte = dateOrError(req.query.desde, 'desde');
      if (req.query.hasta) filter.fecha_hora.$lte = dateOrError(req.query.hasta, 'hasta');
    }
    const sort = parseSort(req.query.sort, ['fecha_hora', 'costo', 'creado_en'], ['fecha_hora', 1]);
    const [items, total] = await Promise.all([
      db.collection('citas').find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      db.collection('citas').countDocuments(filter)
    ]);
    res.json({ page, limit, total, items });
  } catch (error) { next(error); }
});

router.patch('/:id/estado', async (req, res, next) => {
  try {
    const db = getDb();
    if (!ESTADOS.includes(req.body.estado)) throw badRequest(`estado debe ser uno de: ${ESTADOS.join(', ')}`);
    const result = await db.collection('citas').findOneAndUpdate(
      { _id: objectId(req.params.id) },
      { $set: { estado: req.body.estado } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(result);
  } catch (error) { next(error); }
});

router.get('/agenda/dia', async (req, res, next) => {
  try {
    const db = getDb();
    const fecha = req.query.fecha ? dateOrError(req.query.fecha, 'fecha') : new Date();
    const start = new Date(fecha); start.setHours(0, 0, 0, 0);
    const end = new Date(fecha); end.setHours(23, 59, 59, 999);
    const diasVacunas = Math.min(Number(req.query.dias_vacunas || 7), 60);
    const vaccineEnd = new Date(end.getTime() + diasVacunas * 24 * 60 * 60000);

    const [citas, vacunas] = await Promise.all([
      db.collection('citas').aggregate([
        { $match: { fecha_hora: { $gte: start, $lte: end }, estado: { $ne: 'cancelada' } } },
        { $lookup: { from: 'mascotas', localField: 'mascota_id', foreignField: '_id', as: 'mascota' } },
        { $unwind: '$mascota' },
        { $project: { codigo: 1, fecha_hora: 1, estado: 1, motivo: 1, veterinario: 1, 'mascota.nombre': 1, 'mascota.especie': 1 } },
        { $sort: { fecha_hora: 1 } }
      ]).toArray(),
      db.collection('mascotas').aggregate([
        { $unwind: '$vacunas' },
        { $match: { 'vacunas.proxima_dosis': { $gte: start, $lte: vaccineEnd }, activo: true } },
        { $lookup: { from: 'clientes', localField: 'cliente_id', foreignField: '_id', as: 'cliente' } },
        { $unwind: '$cliente' },
        { $project: { mascota: '$nombre', especie: 1, vacuna: '$vacunas.nombre', proxima_dosis: '$vacunas.proxima_dosis', propietario: { $concat: ['$cliente.nombre', ' ', '$cliente.apellido'] }, telefono: '$cliente.telefono' } },
        { $sort: { proxima_dosis: 1 } }
      ]).toArray()
    ]);

    res.json({ fecha: start, citas, vacunas_proximas: vacunas });
  } catch (error) { next(error); }
});

module.exports = router;
