const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startDatabase, clearDatabase, stopDatabase } = require('./setup-db');
const mongoose = require('mongoose');
const request = require('supertest');
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:4200,https://www.toniribeiro.com';
const app = require('../../worker/app.cjs');
const Booking = require('../models/lift-booking');
const { nextConfirmationAt } = require('../services/lift-next-alarm');
const { today, dateAfter } = require('../services/lift-schedule');

describe('Cloudflare Express entry and durable alarm selection', () => {
  before(async () => { await startDatabase(); process.env.MONGODB_URI = mongoose.connection.client.s.url; });
  after(stopDatabase);
  beforeEach(clearDatabase);
  it('retains health checks and routes new bookings using the existing login', async () => {
    const health = await request(app).get('/api/health').expect(200);
    assert.equal(health.body.configured, true);
    const signup = await request(app).post('/api/ribeiro/user/signup').send({ email: 'worker-test@example.com', password: 'password-1234', name: 'Worker test' }).expect(201);
    const booking = await request(app).post('/api/ribeiro/lift-bookings').set('Authorization', `Bearer ${signup.body.token}`)
      .send({ serviceDate: dateAfter(today(), 1), startHour: 9, passengers: 3, whatsapp: '0821234567', pickup: { address: 'Rosebank, Johannesburg' }, dropoff: { address: 'Sandton City' } }).expect(201);
    assert.equal(await nextConfirmationAt(), Date.parse(booking.body.booking.confirmationDueAt));
    await request(app).post('/api/ribeiro/lift-bookings').set('Authorization', `Bearer ${signup.body.token}`)
      .send({ serviceDate: dateAfter(today(), 1), startHour: 9, passengers: 1, whatsapp: '0821234567', pickup: { address: 'Rosebank, Johannesburg' }, dropoff: { address: 'Sandton City' } }).expect(409);
    const ready = await request(app).get('/api/health').expect(200);
    assert.equal(ready.body.databaseReady, true);
    assert.equal(ready.body.databaseInitialization, 'ready');
    const availability = await request(app).get('/api/ribeiro/lift-bookings/availability').set('Origin', 'https://www.toniribeiro.com').expect(200);
    assert.equal(availability.headers['access-control-allow-origin'], 'https://www.toniribeiro.com');
    assert.equal(availability.body.taken.length, 1);
  });
  it('does not keep an alarm when no pending confirmations remain', async () => {
    assert.equal(await nextConfirmationAt(), null);
  });
  it('uses the earliest pending due date or expired sending lease, rather than a claimed booking old due date', async () => {
    const user = new mongoose.Types.ObjectId();
    const base = { user, serviceDate: dateAfter(today(), 1), startHour: 8, passengers: 1, confirmationDueAt: new Date(Date.now() + 300000) };
    const pending = await Booking.create({ ...base, scheduledFor: new Date(Date.now() + 3600000) });
    await Booking.create({ ...base, scheduledFor: new Date(Date.now() + 7200000), confirmationDueAt: new Date(0), notificationState: 'sending', leaseUntil: new Date(Date.now() + 600000) });
    assert.equal(await nextConfirmationAt(), pending.confirmationDueAt.getTime());
  });
});
