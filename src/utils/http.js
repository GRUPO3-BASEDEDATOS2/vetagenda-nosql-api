const { ObjectId } = require('mongodb');

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function objectId(value, field = 'id') {
  if (typeof value !== 'string' || !ObjectId.isValid(value)) throw badRequest(`${field} no tiene un ObjectId válido`);
  return new ObjectId(value);
}

// Rechaza objetos/arreglos en filtros (?campo[$ne]=x) para evitar inyección de operadores.
function str(value, field) {
  if (typeof value !== 'string') throw badRequest(`${field} debe ser texto`);
  return value;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function positiveInt(value, fallback, max = 100) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function pagination(query) {
  const page = positiveInt(query.page, 1, 100000);
  const limit = positiveInt(query.limit, 10, 50);
  return { page, limit, skip: (page - 1) * limit };
}

function parseSort(value, allowed, fallback = ['creado_en', -1]) {
  if (typeof value !== 'string' || !value) return { [fallback[0]]: fallback[1] };
  const desc = value.startsWith('-');
  const field = desc ? value.slice(1) : value;
  if (!allowed.includes(field)) return { [fallback[0]]: fallback[1] };
  return { [field]: desc ? -1 : 1 };
}

function dateOrError(value, field) {
  const d = new Date(value);
  if (typeof value !== 'string' && typeof value !== 'number') throw badRequest(`${field} debe ser una fecha válida`);
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} debe ser una fecha válida`);
  return d;
}

module.exports = { badRequest, objectId, str, escapeRegex, pagination, parseSort, dateOrError };
