const express = require('express');
const { getDb } = require('../db');
const { pagination, parseSort, objectId, str, escapeRegex } = require('../utils/http');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const db = getDb();
    const doc = {
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      email: typeof req.body.email === 'string' ? req.body.email.toLowerCase() : req.body.email,
      telefono: req.body.telefono,
      direccion: req.body.direccion,
      activo: req.body.activo ?? true,
      creado_en: new Date()
    };
    const result = await db.collection('clientes').insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.query.ciudad) filter['direccion.ciudad'] = str(req.query.ciudad, 'ciudad');
    if (req.query.activo !== undefined) filter.activo = req.query.activo === 'true';
    if (req.query.q) {
      const q = escapeRegex(str(req.query.q, 'q'));
      filter.$or = [
        { nombre: { $regex: q, $options: 'i' } },
        { apellido: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }
    const sort = parseSort(req.query.sort, ['nombre', 'apellido', 'creado_en']);
    const [items, total] = await Promise.all([
      db.collection('clientes').find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      db.collection('clientes').countDocuments(filter)
    ]);
    res.json({ page, limit, total, items });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const cliente = await db.collection('clientes').findOne({ _id: objectId(req.params.id) });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (error) { next(error); }
});

module.exports = router;
