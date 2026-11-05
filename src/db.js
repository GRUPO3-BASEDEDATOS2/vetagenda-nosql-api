const { MongoClient } = require('mongodb');

let client;
let database;

async function connectDb() {
  if (database) return database;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'veterinaria_nosql';
  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);
  return database;
}

function getDb() {
  if (!database) throw new Error('La base de datos todavía no está conectada');
  return database;
}

async function closeDb() {
  if (client) await client.close();
  client = undefined;
  database = undefined;
}

module.exports = { connectDb, getDb, closeDb };
