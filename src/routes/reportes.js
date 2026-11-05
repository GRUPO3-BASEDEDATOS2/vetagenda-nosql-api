const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/vacunas-proximas', async (req, res, next) => {
  try {
    const db = getDb();
    const dias = Math.min(Math.max(Number(req.query.dias || 30), 1), 365);
    const desde = new Date();
    const hasta = new Date(desde.getTime() + dias * 24 * 60 * 60000);

    const pipeline = [
      { $unwind: '$vacunas' },
      { $match: { activo: true, 'vacunas.proxima_dosis': { $gte: desde, $lte: hasta } } },
      { $lookup: { from: 'clientes', localField: 'cliente_id', foreignField: '_id', as: 'cliente' } },
      { $unwind: '$cliente' },
      {
        $group: {
          _id: { especie: '$especie', vacuna: '$vacunas.nombre' },
          total_mascotas: { $sum: 1 },
          primera_fecha: { $min: '$vacunas.proxima_dosis' },
          mascotas: {
            $push: {
              mascota: '$nombre',
              propietario: { $concat: ['$cliente.nombre', ' ', '$cliente.apellido'] },
              telefono: '$cliente.telefono',
              fecha: '$vacunas.proxima_dosis'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          especie: '$_id.especie',
          vacuna: '$_id.vacuna',
          total_mascotas: 1,
          primera_fecha: 1,
          mascotas: 1
        }
      },
      { $sort: { primera_fecha: 1, especie: 1, vacuna: 1 } }
    ];

    const items = await db.collection('mascotas').aggregate(pipeline).toArray();
    res.json({ desde, hasta, grupos: items.length, items });
  } catch (error) { next(error); }
});

router.get('/citas-mensuales', async (req, res, next) => {
  try {
    const db = getDb();
    const pipeline = [
      { $match: { estado: { $in: ['completada', 'confirmada', 'programada'] } } },
      {
        $group: {
          _id: { anio: { $year: '$fecha_hora' }, mes: { $month: '$fecha_hora' } },
          citas: { $sum: 1 },
          ingresos: { $sum: '$costo' },
          ticket_promedio: { $avg: '$costo' }
        }
      },
      { $project: { _id: 0, anio: '$_id.anio', mes: '$_id.mes', citas: 1, ingresos: { $round: ['$ingresos', 2] }, ticket_promedio: { $round: ['$ticket_promedio', 2] } } },
      { $sort: { anio: 1, mes: 1 } }
    ];
    const items = await db.collection('citas').aggregate(pipeline).toArray();
    res.json(items);
  } catch (error) { next(error); }
});

module.exports = router;
