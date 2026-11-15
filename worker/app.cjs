// Cloudflare entry: reuse the backend routes with the deployed Worker's lazy pool.
// The ordinary Node server keeps backend/app.js as its own entry point.
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
// Build indexes explicitly in an awaited request, rather than starting background
// model initialization that can outlive its Cloudflare request context.
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { AsyncLocalStorage } = require('node:async_hooks');
const { mailSettings } = require('../backend/services/ribeiro-mail');
const app = express();
const requestContext = new AsyncLocalStorage();
let connectionPromise;
let databaseReady = false;

async function connectToDatabase() {
  if (databaseReady && mongoose.connection.readyState === 1) return;
  if (!process.env.MONGODB_URI) throw new Error('Database configuration is missing.');
  if (!connectionPromise) {
    connectionPromise = (async () => {
      databaseReady = false;
      app.locals.databaseInitialization = 'connecting';
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI, {
          maxPoolSize: 1, minPoolSize: 0, maxIdleTimeMS: 20000,
          serverMonitoringMode: 'poll',
          serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000,
          socketTimeoutMS: 15000, waitQueueTimeoutMS: 10000,
          autoIndex: false, autoCreate: false,
        });
      }
      app.locals.databaseInitialization = 'indexes';
      for (const model of [
        require('../backend/models/lift-booking'),
        require('../backend/models/user-ribeiro'),
        require('../backend/models/auth-throttle'),
      ]) {
        const collection = mongoose.connection.db.collection(model.collection.name);
        for (const [key, options] of model.schema.indexes()) {
          await collection.createIndex(key, { ...options, maxTimeMS: 10000 });
        }
      }
      databaseReady = true;
      app.locals.databaseInitialization = 'ready';
    })().catch((error) => {
      app.locals.databaseInitialization = 'failed';
      throw error;
    }).finally(() => { connectionPromise = undefined; });
  }
  await connectionPromise;
}

app.locals.requestContext = requestContext;
app.locals.runtime = 'cloudflare';
app.locals.connectToDatabase = connectToDatabase;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
}));
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { req.waitUntil = requestContext.getStore(); next(); });
app.get('/api/health', (req, res) => {
  const configured = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET);
  res.status(configured ? 200 : 503).json({
    service: 'digiterra-backend', configured,
    databaseConnected: mongoose.connection.readyState === 1,
    databaseReady,
    databaseInitialization: app.locals.databaseInitialization || 'not-started',
    bookingEmailConfigured: Boolean(mailSettings()),
  });
});
app.use(async (req, res, next) => {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) return res.status(503).json({ message: 'Backend configuration is incomplete.' });
  try { await connectToDatabase(); next(); } catch (error) { next(error); }
});

app.get('/api/customers', async (req, res, next) => {
  try { res.json({ message: 'Customers fetched successfully', customers: await require('../backend/models/customer').find() }); }
  catch (error) { next(error); }
});
app.use('/api/user', require('../backend/routes/user'));
app.use('/api/user/loaded', require('../backend/routes/user-loaded'));
app.use('/api/customers', require('../backend/routes/customers'));
app.use('/api/ribeiro-cafe', require('../backend/routes/cv'));
app.use('/api/vla/user', require('../backend/routes/user-vla'));
app.use('/api/matla', require('../backend/routes/emails'));
app.use('/api/ribeiro/user', require('../backend/routes/user-ribeiro'));
app.use('/api/ribeiro/date-selections', require('../backend/routes/date-selections'));
app.use('/api/ribeiro/lift-bookings', require('../backend/routes/lift-bookings'));
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error('Backend request failed:', error.name);
  if (!res.headersSent) res.status(error.status || 500).json({ message: 'Unable to process this request. Please try again.' });
});
module.exports = app;
