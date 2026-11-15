const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startDatabase, clearDatabase, stopDatabase } = require('./setup-db');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/user-ribeiro');
const { processRecoveryEmails, queueReset, hashToken, nextRecoveryAt, allowAttempt } = require('../services/password-recovery');
const BASE = '/api/ribeiro/user';
const EMAIL = 'recovery@example.com';
const OLD_PASSWORD = 'old-password-123';
const NEW_PASSWORD = 'new-password-456';
const mail = () => ({ messages: [], async sendMail(message) { this.messages.push(message); } });
const tokenFrom = (message) => message.text.match(/#token=([a-f0-9]{64})/)[1];

describe('Password recovery and revocable sessions', () => {
  let user;
  before(startDatabase);
  after(stopDatabase);
  beforeEach(async () => {
    await clearDatabase();
    user = await User.create({ email: EMAIL, name: 'Ann', password: await bcrypt.hash(OLD_PASSWORD, 4), authProviders: ['password'] });
  });
  const issue = async () => {
    await queueReset(EMAIL, 'http://localhost:4200');
    const transport = mail();
    assert.equal(await processRecoveryEmails({ transport }), 1);
    return tokenFrom(transport.messages[0]);
  };

  it('rejects missing JWT configuration before signup writes an account', async () => {
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      await request(app).post(`${BASE}/signup`).send({ email: 'new@example.com', name: 'New', password: NEW_PASSWORD }).expect(503);
      await request(app).post(`${BASE}/signin`).send({ email: EMAIL, password: OLD_PASSWORD }).expect(503);
      assert.equal(await User.countDocuments(), 1);
    } finally { process.env.JWT_SECRET = secret; }
  });

  it('uses the same response for known/unknown emails and never trusts arbitrary redirect origins', async () => {
    const known = await request(app).post(`${BASE}/forgot-password`).set('Origin', 'https://attacker.invalid').send({ email: EMAIL }).expect(202);
    const unknown = await request(app).post(`${BASE}/forgot-password`).send({ email: 'unknown@example.com' }).expect(202);
    assert.deepEqual(known.body, unknown.body);
    assert.equal((await User.findById(user._id)).passwordReset, undefined);
    const queued = await User.findById(user._id).select('+passwordReset');
    assert.equal(queued.passwordReset.appOrigin, process.env.RIBEIRO_APP_URL);
    assert.ok(queued.passwordReset.encryptedToken);
    assert.equal(queued.passwordReset.expiresAt - queued.passwordReset.requestedAt, 30 * 60000);
    const transport = mail();
    await processRecoveryEmails({ transport });
    const token = tokenFrom(transport.messages[0]);
    assert.equal(queued.passwordReset.tokenHash, hashToken(token));
    assert.ok(!queued.passwordReset.encryptedToken.includes(token));
    const delivered = await User.findById(user._id).select('+passwordReset');
    assert.equal(delivered.passwordReset.encryptedToken, undefined);
    assert.equal(delivered.passwordReset.state, 'sent');
  });

  it('uses the requesting frontend origin for local and production links', async () => {
    await request(app).post(`${BASE}/forgot-password`).set('Origin', 'http://127.0.0.1:4200').send({ email: EMAIL }).expect(202);
    const transport = mail();
    await processRecoveryEmails({ transport });
    assert.match(transport.messages[0].text, /http:\/\/127\.0\.0\.1:4200\/reset-password#token=/);
  });

  it('changes the password once, revokes all prior Ribeiro sessions, and queues a security notice', async () => {
    const oldToken = jwt.sign({ email: EMAIL, userId: user._id }, process.env.JWT_SECRET);
    await request(app).get(`${BASE}/me`).set('Authorization', `Bearer ${oldToken}`).expect(200);
    const token = await issue();
    const result = await request(app).post(`${BASE}/reset-password`).send({ token, password: NEW_PASSWORD }).expect(200);
    assert.equal(result.body.token, undefined);
    await request(app).post(`${BASE}/reset-password`).send({ token, password: 'different-pass' }).expect(400);
    await request(app).post(`${BASE}/signin`).send({ email: EMAIL, password: OLD_PASSWORD }).expect(401);
    const signedIn = await request(app).post(`${BASE}/signin`).send({ email: EMAIL, password: NEW_PASSWORD }).expect(200);
    assert.equal(jwt.verify(signedIn.body.token, process.env.JWT_SECRET).authVersion, 1);
    for (const path of [`${BASE}/me`, '/api/ribeiro/lift-bookings', '/api/ribeiro/date-selections']) {
      await request(app).get(path).set('Authorization', `Bearer ${oldToken}`).expect(401);
    }
    await request(app).get(`${BASE}/me`).set('Authorization', `Bearer ${signedIn.body.token}`).expect(200);
    const transport = mail();
    assert.equal(await processRecoveryEmails({ transport }), 1);
    assert.match(transport.messages[0].subject, /password was changed/);
    assert.ok(!transport.messages[0].text.includes(NEW_PASSWORD));
    assert.equal(await nextRecoveryAt(), null);
  });

  it('lets only one concurrent reset consume a token', async () => {
    const token = await issue();
    const results = await Promise.all([NEW_PASSWORD, 'another-password'].map((password) =>
      request(app).post(`${BASE}/reset-password`).send({ token, password })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
    assert.equal((await User.findById(user._id)).authVersion, 1);
  });

  it('rejects expired and malformed tokens, keeping the password unchanged', async () => {
    const token = await issue();
    await User.updateOne({ _id: user._id }, { $set: { 'passwordReset.expiresAt': new Date(Date.now() - 1) } });
    await request(app).post(`${BASE}/reset-password`).send({ token, password: NEW_PASSWORD }).expect(400);
    await request(app).post(`${BASE}/reset-password`).send({ token: { $ne: null }, password: NEW_PASSWORD }).expect(400);
    assert.ok(await bcrypt.compare(OLD_PASSWORD, (await User.findById(user._id)).password));
  });

  it('does not truncate multibyte passwords at the bcrypt limit', async () => {
    const token = await issue();
    await request(app).post(`${BASE}/reset-password`).send({ token, password: '😀'.repeat(19) }).expect(400);
    await request(app).post(`${BASE}/reset-password`).send({ token, password: 'short' }).expect(400);
    await request(app).post(`${BASE}/reset-password`).send({ token, password: NEW_PASSWORD }).expect(200);
  });

  it('allows a verified mailbox owner to add a password to a Google account', async () => {
    await User.updateOne({ _id: user._id }, { $unset: { password: 1 }, $set: { authProviders: ['google'], googleId: 'google-id' } });
    const token = await issue();
    await request(app).post(`${BASE}/reset-password`).send({ token, password: NEW_PASSWORD }).expect(200);
    assert.deepEqual([...(await User.findById(user._id)).authProviders], ['google', 'password']);
    await request(app).post(`${BASE}/signin`).send({ email: EMAIL, password: NEW_PASSWORD }).expect(200);
  });

  it('persists SMTP retries and stops delivery when a link expires', async () => {
    const now = new Date();
    await queueReset(EMAIL, 'http://localhost:4200', now);
    const failed = { sendMail: async () => { throw Object.assign(new Error('SMTP unavailable'), { code: 'ECONNECTION' }); } };
    assert.equal(await processRecoveryEmails({ transport: failed, now }), 0);
    assert.equal(await nextRecoveryAt(), now.getTime() + 60000);
    const transport = mail();
    assert.equal(await processRecoveryEmails({ transport, now }), 0);
    assert.equal(await processRecoveryEmails({ transport, now: new Date(now.getTime() + 60001) }), 1);
    await User.updateOne({ _id: user._id }, { $unset: { passwordReset: 1 } });
    await queueReset(EMAIL, 'http://localhost:4200', now);
    assert.equal(await processRecoveryEmails({ transport, now: new Date(now.getTime() + 31 * 60000) }), 0);
    assert.equal(await User.countDocuments(), 1);
  });

  it('avoids duplicate delivery across concurrent workers and skips deleted accounts', async () => {
    await queueReset(EMAIL, 'http://localhost:4200');
    const transport = mail();
    await Promise.all([processRecoveryEmails({ transport }), processRecoveryEmails({ transport })]);
    assert.equal(transport.messages.length, 1);
    await User.deleteOne({ _id: user._id });
    assert.equal(await processRecoveryEmails({ transport }), 0);
  });

  it('persists rate limits across callers without storing the raw identity', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => allowAttempt('test', EMAIL, 3, 60000)));
    assert.equal(results.filter(Boolean).length, 3);
    const counters = await require('../models/auth-throttle').find().lean();
    assert.ok(!JSON.stringify(counters).includes(EMAIL));
  });

  it('retains an issued link during the resend cooldown', async () => {
    await queueReset(EMAIL, 'http://localhost:4200');
    const first = (await User.findById(user._id).select('+passwordReset')).passwordReset.tokenHash;
    await request(app).post(`${BASE}/forgot-password`).send({ email: EMAIL }).expect(202);
    assert.equal((await User.findById(user._id).select('+passwordReset')).passwordReset.tokenHash, first);
  });
});
