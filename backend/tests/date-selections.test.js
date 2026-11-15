const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startDatabase, clearDatabase, stopDatabase } = require('./setup-db');

const request = require('supertest');
const app = require('../app');
const DateSelection = require('../models/date-selection');

const BASE = '/api/ribeiro/date-selections';
const nextYear = new Date().getFullYear() + 1;

const selection = (overrides = {}) => ({
  selectedDate: `${nextYear}-03-14`,
  selectedTime: '07:30',
  timeZone: 'Africa/Johannesburg',
  scheduledFor: `${nextYear}-03-14T07:30:00+02:00`,
  service: 'lift-club',
  note: 'Pick-up at the main gate',
  ...overrides,
});

const signUp = async (email) => {
  const res = await request(app)
    .post('/api/ribeiro/user/signup')
    .send({ email, password: 'password-1234', name: 'Test' })
    .expect(201);
  return res.body.token;
};

describe('Date selections API', () => {
  let token;
  let otherToken;

  before(startDatabase);
  after(stopDatabase);
  beforeEach(async () => {
    await clearDatabase();
    token = await signUp('owner@example.com');
    otherToken = await signUp('someone-else@example.com');
  });

  const authed = (method, url, bearer = token) => request(app)[method](url).set('Authorization', `Bearer ${bearer}`);

  it('requires authentication on every route', async () => {
    await request(app).get(BASE).expect(401);
    await request(app).post(BASE).send(selection()).expect(401);
    await request(app).put(`${BASE}/000000000000000000000000`).send({ note: 'x' }).expect(401);
    await request(app).delete(`${BASE}/000000000000000000000000`).expect(401);
  });

  it('stores a selection against the signed-in user', async () => {
    const res = await authed('post', BASE).send(selection()).expect(201);

    assert.equal(res.body.dateSelection.selectedDate, `${nextYear}-03-14`);
    assert.equal(res.body.dateSelection.selectedTime, '07:30');
    assert.equal(res.body.dateSelection.scheduledFor, `${nextYear}-03-14T05:30:00.000Z`);

    const stored = await DateSelection.findById(res.body.dateSelection._id).populate('user');
    assert.equal(stored.user.email, 'owner@example.com');
  });

  it('ignores a user field in the body', async () => {
    const res = await authed('post', BASE).send({ ...selection(), user: '000000000000000000000000' }).expect(201);
    const stored = await DateSelection.findById(res.body.dateSelection._id).populate('user');
    assert.equal(stored.user.email, 'owner@example.com');
  });

  it('lists only the signed-in user\'s selections, soonest first', async () => {
    await authed('post', BASE).send(selection({ selectedDate: `${nextYear}-05-01`, scheduledFor: `${nextYear}-05-01T07:30:00+02:00` }));
    await authed('post', BASE).send(selection());
    await authed('post', BASE, otherToken).send(selection());

    const res = await authed('get', BASE).expect(200);
    assert.deepEqual(
      res.body.dateSelections.map((s) => s.selectedDate),
      [`${nextYear}-03-14`, `${nextYear}-05-01`]
    );
  });

  it('rejects past dates, malformed times and unknown services', async () => {
    await authed('post', BASE).send(selection({ scheduledFor: '2001-01-01T00:00:00Z' })).expect(400);
    await authed('post', BASE).send(selection({ scheduledFor: 'tomorrow-ish' })).expect(400);
    await authed('post', BASE).send(selection({ selectedTime: '25:00' })).expect(400);
    await authed('post', BASE).send(selection({ service: 'helicopter' })).expect(400);
    assert.equal(await DateSelection.countDocuments(), 0);
  });

  it('updates a selection only for its owner', async () => {
    const id = (await authed('post', BASE).send(selection())).body.dateSelection._id;

    await authed('put', `${BASE}/${id}`, otherToken).send({ note: 'hijacked' }).expect(404);
    const res = await authed('put', `${BASE}/${id}`).send({ note: 'Gate B instead' }).expect(200);

    assert.equal(res.body.dateSelection.note, 'Gate B instead');
    assert.equal((await DateSelection.findById(id)).note, 'Gate B instead');
  });

  it('validates updates', async () => {
    const id = (await authed('post', BASE).send(selection())).body.dateSelection._id;
    await authed('put', `${BASE}/${id}`).send({ selectedTime: '7am' }).expect(400);
    await authed('put', `${BASE}/${id}`).send({ scheduledFor: '2001-01-01T00:00:00Z' }).expect(400);
  });

  it('deletes a selection only for its owner', async () => {
    const id = (await authed('post', BASE).send(selection())).body.dateSelection._id;

    await authed('delete', `${BASE}/${id}`, otherToken).expect(404);
    await authed('delete', `${BASE}/not-an-id`).expect(404);
    await authed('delete', `${BASE}/${id}`).expect(200);

    assert.equal(await DateSelection.countDocuments(), 0);
  });
});
