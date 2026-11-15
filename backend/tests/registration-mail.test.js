const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { startDatabase, clearDatabase, stopDatabase } = require('./setup-db');
const request = require('supertest');
const { OAuth2Client } = require('google-auth-library');
const app = require('../app');
const User = require('../models/user-ribeiro');
const { processRegistrationEmails, nextRegistrationAt } = require('../services/registration-mail');
const BASE = '/api/ribeiro/user';
const details = { email: 'registration@example.com', password: 'password-1234', name: 'Ann' };
const mail = () => ({ messages: [], async sendMail(message) { this.messages.push(message); } });

describe('Registration emails and optional cellphone numbers', () => {
  before(startDatabase);
  after(stopDatabase);
  beforeEach(clearDatabase);
  afterEach(() => mock.restoreAll());

  it('queues a welcome email with account creation and saves a normalized optional phone', async () => {
    const response = await request(app).post(`${BASE}/signup`).set('Origin', 'http://localhost:4200')
      .send({ ...details, phone: '+27 (82) 123-4567' }).expect(201);
    assert.equal(response.body.userInformationOnSignIn.phone, '+27821234567');
    assert.equal(response.body.userInformationOnSignIn.registrationEmail, undefined);
    const user = await User.findOne({ email: details.email }).select('+registrationEmail');
    assert.equal(user.phone, '+27821234567');
    assert.equal(user.registrationEmail.state, 'pending');
    assert.equal(await nextRegistrationAt(), user.registrationEmail.nextAttemptAt.getTime());
    const transport = mail();
    assert.equal(await processRegistrationEmails({ transport, from: 'bookings@toniribeiro.co.za' }), 1);
    assert.equal(transport.messages[0].to, details.email);
    assert.match(transport.messages[0].text, /http:\/\/localhost:4200\/lift-club/);
    assert.ok(!transport.messages[0].text.includes(details.password));
    assert.equal(await nextRegistrationAt(), null);
    await request(app).post(`${BASE}/signin`).send(details).expect(200);
    assert.equal(await processRegistrationEmails({ transport }), 0);
  });

  it('keeps the phone optional and validates it on the backend', async () => {
    for (const phone of ['no-number', '+2782', '1234567890123456', {}, '---']) {
      await request(app).post(`${BASE}/signup`).send({ ...details, phone }).expect(400);
    }
    assert.equal(await User.countDocuments(), 0);
    const response = await request(app).post(`${BASE}/signup`).send({ ...details, phone: '   ' }).expect(201);
    assert.equal(response.body.userInformationOnSignIn.phone, null);
  });

  it('queues mail only for the first Google registration, including when signing in again', async () => {
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({
      sub: 'new-google-user', email: 'newuser@gmail.com', email_verified: true, given_name: 'New',
    }) }));
    await request(app).post(`${BASE}/google`).set('Origin', 'https://www.toniribeiro.com').send({ credential: 'test-token' }).expect(200);
    const transport = mail();
    assert.equal(await processRegistrationEmails({ transport }), 1);
    assert.match(transport.messages[0].text, /https:\/\/www.toniribeiro.com\/lift-club/);
    await request(app).post(`${BASE}/google`).send({ credential: 'test-token' }).expect(200);
    assert.equal(await processRegistrationEmails({ transport }), 0);
    assert.equal(transport.messages.length, 1);
  });

  it('does not recreate pending mail on rejected or duplicate registrations', async () => {
    await request(app).post(`${BASE}/signup`).send(details).expect(201);
    const transport = mail();
    await processRegistrationEmails({ transport });
    await request(app).post(`${BASE}/signup`).send(details).expect(409);
    assert.equal(await processRegistrationEmails({ transport }), 0);
    assert.equal(await User.countDocuments(), 1);
  });

  it('retries SMTP failure, preserves pending work, and prevents concurrent delivery', async () => {
    await request(app).post(`${BASE}/signup`).send(details).expect(201);
    const now = new Date();
    const failing = { sendMail: async () => { throw Object.assign(new Error('unavailable'), { code: 'SMTP_TEST' }); } };
    assert.equal(await processRegistrationEmails({ transport: failing, now }), 0);
    assert.equal(await nextRegistrationAt(), now.getTime() + 60000);
    const transport = mail();
    assert.equal(await processRegistrationEmails({ transport, now }), 0);
    const later = new Date(now.getTime() + 60001);
    await Promise.all([processRegistrationEmails({ transport, now: later }), processRegistrationEmails({ transport, now: later })]);
    assert.equal(transport.messages.length, 1);
    assert.equal(await nextRegistrationAt(), null);
  });

  it('recovers a stale lease and escapes user names in HTML emails', async () => {
    await request(app).post(`${BASE}/signup`).send({ ...details, name: '<img src=x onerror=alert(1)>' }).expect(201);
    await User.updateOne({ email: details.email }, { $set: {
      'registrationEmail.state': 'sending', 'registrationEmail.leaseUntil': new Date(0), 'registrationEmail.claimId': 'crashed',
    } });
    assert.equal(await nextRegistrationAt(), 0);
    const transport = mail();
    assert.equal(await processRegistrationEmails({ transport }), 1);
    assert.ok(!transport.messages[0].html.includes('<img'));
    assert.ok(transport.messages[0].html.includes('&lt;img'));
  });

  it('removes pending mail along with a deleted account', async () => {
    const response = await request(app).post(`${BASE}/signup`).send(details).expect(201);
    await request(app).delete(`${BASE}/me`).set('Authorization', `Bearer ${response.body.token}`).expect(200);
    assert.equal(await processRegistrationEmails({ transport: mail() }), 0);
    assert.equal(await nextRegistrationAt(), null);
  });
});
