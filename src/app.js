require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDb } = require('./db');
const clientes = require('./routes/clientes');
const mascotas = require('./routes/mascotas');
const citas = require('./routes/citas');
const reportes = require('./routes/reportes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => { req.body ??= {}; next(); });

app.get('/health', (req, res) => res.json({ ok: true, servicio: 'VetAgenda NoSQL API' }));
app.use('/api/clientes', clientes);
app.use('/api/mascotas', mascotas);
app.use('/api/citas', citas);
app.use('/api/reportes', reportes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((error, req, res, next) => {
  if (error.code === 11000) return res.status(409).json({ error: 'Dato duplicado', detalle: error.keyValue });
  if (error.code === 121) return res.status(400).json({ error: 'El documento no cumple el $jsonSchema de MongoDB', detalle: error.errInfo?.details || error.message });
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Error interno' });
});

const port = Number(process.env.PORT || 3000);
connectDb()
  .then(() => app.listen(port, () => console.log(`VetAgenda API escuchando en http://localhost:${port}`)))
  .catch(error => {
    console.error('No fue posible conectar con MongoDB:', error.message);
    process.exit(1);
  });
