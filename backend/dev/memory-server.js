// Runs the API against a throwaway in-memory MongoDB so the full stack can be tried
// locally without Atlas access. Everything stored is lost when the process stops.
const { existsSync } = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('../config/runtime-env');
process.env.JWT_SECRET ??= 'local-development-only-secret';

MongoMemoryServer.create().then((mongoServer) => {
  process.env.MONGODB_URI = mongoServer.getUri('ribeiroDev');
  console.log(`In-memory MongoDB running at ${process.env.MONGODB_URI}`);
  require('../../server');
});
