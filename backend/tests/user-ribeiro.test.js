const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { startDatabase, clearDatabase, stopDatabase } = require('./setup-db');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const app = require('../app');
const RibeiroUser = require('../models/user-ribeiro');
const DateSelection = require('../models/date-selection');

const BASE = '/api/ribeiro/user';
const newUser = { email: 'Lerato@Example.com', password: 'correct-horse-battery', name: 'Lerato', surname: 'Mokoena' };

const stubGooglePayload = (payload) =>
  mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => payload }));

describe('Ribeiro user API', () => {
  before(startDatabase);
  after(stopDatabase);
  beforeEach(clearDatabase);
  afterEach(() => mock.restoreAll());

  describe('POST /signup', () => {
    it('creates the user with a bcrypt hash and signs them in', async () => {
      const res = await request(app).post(`${BASE}/signup`).send(newUser).expect(201);

      assert.equal(res.body.expiresIn, 3600);
      assert.equal(res.body.userInformationOnSignIn.email, 'lerato@example.com');
      assert.equal(res.body.userInformationOnSignIn.password, undefined);

      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      assert.equal(decoded.email, 'lerato@example.com');

      const stored = await RibeiroUser.findOne({ email: 'lerato@example.com' });
      assert.notEqual(stored.password, newUser.password);
      assert.match(stored.password, /^\$2[aby]\$12\$/);
      assert.deepEqual([...stored.authProviders], ['password']);
      assert.equal(decoded.userId, stored._id.toString());
    });

    it('rejects a duplicate email regardless of case', async () => {
      await request(app).post(`${BASE}/signup`).send(newUser).expect(201);
      const res = await request(app)
        .post(`${BASE}/signup`)
        .send({ ...newUser, email: 'LERATO@example.com' })
        .expect(409);
      assert.match(res.body.message, /already exists/);
    });

    it('validates email, password length and name', async () => {
      await request(app).post(`${BASE}/signup`).send({ ...newUser, email: 'not-an-email' }).expect(400);
      await request(app).post(`${BASE}/signup`).send({ ...newUser, password: 'short' }).expect(400);
      await request(app).post(`${BASE}/signup`).send({ ...newUser, password: 'x'.repeat(73) }).expect(400);
      await request(app).post(`${BASE}/signup`).send({ ...newUser, name: '  ' }).expect(400);
      assert.equal(await RibeiroUser.countDocuments(), 0);
    });
  });

  describe('POST /signin', () => {
    beforeEach(() => request(app).post(`${BASE}/signup`).send(newUser).expect(201));

    it('returns a token for the correct password', async () => {
      const res = await request(app)
        .post(`${BASE}/signin`)
        .send({ email: newUser.email, password: newUser.password })
        .expect(200);
      assert.ok(jwt.verify(res.body.token, process.env.JWT_SECRET));
      assert.equal(res.body.userInformationOnSignIn.name, 'Lerato');
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app)
        .post(`${BASE}/signin`)
        .send({ email: newUser.email, password: 'wrong-password' })
        .expect(401);
      const unknownEmail = await request(app)
        .post(`${BASE}/signin`)
        .send({ email: 'nobody@example.com', password: newUser.password })
        .expect(401);
      assert.equal(wrongPassword.body.message, unknownEmail.body.message);
    });

    it('requires both fields', async () => {
      await request(app).post(`${BASE}/signin`).send({ email: newUser.email }).expect(400);
    });
  });

  describe('POST /google', () => {
    const googlePayload = {
      sub: 'google-sub-123',
      email: 'thandi@gmail.com',
      email_verified: true,
      given_name: 'Thandi',
      family_name: 'Nkosi',
      picture: 'https://lh3.googleusercontent.com/a/photo',
    };

    it('verifies the credential against the configured client ID and creates the user', async () => {
      const verify = stubGooglePayload(googlePayload);
      const res = await request(app).post(`${BASE}/google`).send({ credential: 'google-id-token' }).expect(200);

      assert.deepEqual(verify.mock.calls[0].arguments[0], {
        idToken: 'google-id-token',
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      assert.ok(jwt.verify(res.body.token, process.env.JWT_SECRET));

      const stored = await RibeiroUser.findOne({ googleId: 'google-sub-123' });
      assert.equal(stored.email, 'thandi@gmail.com');
      assert.equal(stored.password, undefined);
      assert.deepEqual([...stored.authProviders], ['google']);
    });

    it('signs a returning Google user into the same account', async () => {
      stubGooglePayload(googlePayload);
      const first = await request(app).post(`${BASE}/google`).send({ credential: 't1' }).expect(200);
      const second = await request(app).post(`${BASE}/google`).send({ credential: 't2' }).expect(200);
      assert.equal(first.body.userInformationOnSignIn.userId, second.body.userInformationOnSignIn.userId);
      assert.equal(await RibeiroUser.countDocuments(), 1);
    });

    it('links Google to an existing password account when Google is authoritative for the email', async () => {
      await request(app)
        .post(`${BASE}/signup`)
        .send({ ...newUser, email: 'thandi@gmail.com' })
        .expect(201);
      stubGooglePayload(googlePayload);
      await request(app).post(`${BASE}/google`).send({ credential: 't' }).expect(200);

      const stored = await RibeiroUser.findOne({ email: 'thandi@gmail.com' });
      assert.equal(stored.googleId, 'google-sub-123');
      assert.deepEqual([...stored.authProviders].sort(), ['google', 'password']);
      assert.equal(await RibeiroUser.countDocuments(), 1);
    });

    it('refuses to link a non-authoritative email to an existing account', async () => {
      await request(app)
        .post(`${BASE}/signup`)
        .send({ ...newUser, email: 'thandi@yahoo.com' })
        .expect(201);
      stubGooglePayload({ ...googlePayload, email: 'thandi@yahoo.com' });
      await request(app).post(`${BASE}/google`).send({ credential: 't' }).expect(409);

      const stored = await RibeiroUser.findOne({ email: 'thandi@yahoo.com' });
      assert.equal(stored.googleId, undefined);
    });

    it('rejects unverified Google emails', async () => {
      stubGooglePayload({ ...googlePayload, email_verified: false });
      await request(app).post(`${BASE}/google`).send({ credential: 't' }).expect(401);
      assert.equal(await RibeiroUser.countDocuments(), 0);
    });

    it('rejects credentials Google cannot verify', async () => {
      mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => {
        throw new Error('Wrong recipient, payload audience != requiredAudience');
      });
      await request(app).post(`${BASE}/google`).send({ credential: 'forged' }).expect(401);
    });

    it('requires a credential', async () => {
      await request(app).post(`${BASE}/google`).send({}).expect(400);
    });
  });

  describe('GET /me and DELETE /me', () => {
    let token;
    beforeEach(async () => {
      token = (await request(app).post(`${BASE}/signup`).send(newUser)).body.token;
    });

    it('returns the signed-in user', async () => {
      const res = await request(app).get(`${BASE}/me`).set('Authorization', `Bearer ${token}`).expect(200);
      assert.equal(res.body.user.email, 'lerato@example.com');
    });

    it('rejects missing, malformed and wrongly signed tokens', async () => {
      await request(app).get(`${BASE}/me`).expect(401);
      await request(app).get(`${BASE}/me`).set('Authorization', 'Bearer nonsense').expect(401);
      const forged = jwt.sign({ email: 'lerato@example.com', userId: 'x' }, 'some-other-secret');
      await request(app).get(`${BASE}/me`).set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('deletes the account and its date selections', async () => {
      const user = await RibeiroUser.findOne({ email: 'lerato@example.com' });
      await DateSelection.create({
        user: user._id,
        selectedDate: '2099-01-01',
        selectedTime: '08:00',
        scheduledFor: new Date('2099-01-01T06:00:00Z'),
      });

      await request(app).delete(`${BASE}/me`).set('Authorization', `Bearer ${token}`).expect(200);

      assert.equal(await RibeiroUser.countDocuments(), 0);
      assert.equal(await DateSelection.countDocuments(), 0);
    });
  });
});
