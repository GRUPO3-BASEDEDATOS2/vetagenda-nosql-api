const express = require('express');
const { getDb } = require('../db');
const { pagination, parseSort, objectId, str, badRequest, dateOrError } = require('../utils/http');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const db = getDb();
    const clienteId = objectId(req.body.cliente_id, 'cliente_id');
    const cliente = await db.collection('clientes').findOne({ _id: clienteId, activo: true });
    if (!cliente) return res.status(400).json({ error: 'El cliente indicado no existe o está inactivo' });

    const doc = {
      cliente_id: clienteId,
      nombre: req.body.nombre,
      especie: req.body.especie,
      raza: req.body.raza || 'Mestizo',
      sexo: req.body.sexo,
      fecha_nacimiento: dateOrError(req.body.fecha_nacimiento, 'fecha_nacimiento'),
      peso_kg: Number(req.body.peso_kg),
      alergias: Array.isArray(req.body.alergias) ? req.body.alergias : [],
      vacunas: Array.isArray(req.body.vacunas) ? req.body.vacunas.map(v => ({
        nombre: v.nombre,
        fecha_aplicacion: dateOrError(v.fecha_aplicacion, 'vacuna.fecha_aplicacion'),
        proxima_dosis: dateOrError(v.proxima_dosis, 'vacuna.proxima_dosis'),
        lote: v.lote,
        veterinario: v.veterinario
      })) : [],
      activo: req.body.activo ?? true,
      creado_en: new Date()
    };
    const result = await db.collection('mascotas').insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.query.especie) filter.especie = str(req.query.especie, 'especie');
    if (req.query.sexo) filter.sexo = str(req.query.sexo, 'sexo');
    if (req.query.cliente_id) filter.cliente_id = objectId(req.query.cliente_id, 'cliente_id');
    if (req.query.peso_min || req.query.peso_max) {
      filter.peso_kg = {};
      if (req.query.peso_min) filter.peso_kg.$gte = Number(req.query.peso_min);
      if (req.query.peso_max) filter.peso_kg.$lte = Number(req.query.peso_max);
    }
    if (req.query.vacuna_antes) {
      filter.vacunas = { $elemMatch: { proxima_dosis: { $lte: dateOrError(req.query.vacuna_antes, 'vacuna_antes') } } };
    }
    const sort = parseSort(req.query.sort, ['nombre', 'peso_kg', 'fecha_nacimiento', 'creado_en'], ['nombre', 1]);
    const [items, total] = await Promise.all([
      db.collection('mascotas').find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      db.collection('mascotas').countDocuments(filter)
    ]);
    res.json({ page, limit, total, items });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const mascota = await db.collection('mascotas').aggregate([
      { $match: { _id: objectId(req.params.id) } },
      { $lookup: { from: 'clientes', localField: 'cliente_id', foreignField: '_id', as: 'cliente' } },
      { $unwind: '$cliente' },
      { $project: { 'cliente.email': 0, 'cliente.creado_en': 0 } }
    ]).next();
    if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada' });
    res.json(mascota);
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const allowed = ['nombre', 'raza', 'peso_kg', 'alergias', 'activo'];
    const changes = {};
    for (const field of allowed) if (req.body[field] !== undefined) changes[field] = req.body[field];
    if (Object.keys(changes).length === 0) throw badRequest(`Indique al menos un campo a modificar: ${allowed.join(', ')}`);
    if (changes.peso_kg !== undefined) changes.peso_kg = Number(changes.peso_kg);
    const result = await db.collection('mascotas').findOneAndUpdate(
      { _id: objectId(req.params.id) },
      { $set: changes },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Mascota no encontrada' });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/:id/vacunas', async (req, res, next) => {
  try {
    const db = getDb();
    const vacuna = {
      nombre: req.body.nombre,
      fecha_aplicacion: dateOrError(req.body.fecha_aplicacion, 'fecha_aplicacion'),
      proxima_dosis: dateOrError(req.body.proxima_dosis, 'proxima_dosis'),
      lote: req.body.lote,
      veterinario: req.body.veterinario
    };
    const result = await db.collection('mascotas').findOneAndUpdate(
      { _id: objectId(req.params.id) },
      { $push: { vacunas: vacuna } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Mascota no encontrada' });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

module.exports = router;
