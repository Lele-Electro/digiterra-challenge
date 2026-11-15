// Shared setup for the API tests: env vars must be set before backend/app is required.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

async function startDatabase() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  // Build unique indexes up front so duplicate-key behaviour matches production
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
}

async function stopDatabase() {
  await mongoose.disconnect();
  await mongoServer?.stop();
}

module.exports = { startDatabase, clearDatabase, stopDatabase };
