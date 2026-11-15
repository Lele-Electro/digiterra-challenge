const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startDatabase, clearDatabase, stopDatabase } = require('./setup-db');
const request = require('supertest');
const app = require('../app');
const Booking = require('../models/lift-booking');
const { today, dateAfter, validateBooking, QUIET_PERIOD_MS } = require('../services/lift-schedule');
const { processDueBookings } = require('../services/lift-confirmations');

const BASE = '/api/ribeiro/lift-bookings';
const contact = { whatsapp: '082 123 4567', pickup: { address: '12 Oxford Road, Rosebank, Johannesburg', placeId: 'ChIJ-pickup_1', lat: -26.1467, lng: 28.0436 },
  dropoff: { address: 'OR Tambo International Airport' } };
const input = (overrides = {}) => ({ serviceDate: dateAfter(today(), 1), startHour: 8, passengers: 2, ...contact, ...overrides });
const signup = async (email) => (await request(app).post('/api/ribeiro/user/signup')
  .send({ email, password: 'password-1234', name: 'Ann' }).expect(201)).body.token;

describe('Lift club reservations and durable confirmations', () => {
  let token, otherToken;
  const authed = (method, path = BASE, bearer = token) => request(app)[method](path).set('Authorization', `Bearer ${bearer}`);
  const reserve = async (overrides) => (await authed('post').send(input(overrides)).expect(201)).body.booking;
  const makeDue = (id, at = new Date()) => Booking.updateOne({ _id: id }, { $set: { confirmationDueAt: new Date(at.getTime() - 1) } });
  const fakeMail = () => {
    const messages = [];
    return { messages, sendMail: async (message) => { messages.push(message); } };
  };

  before(startDatabase);
  after(stopDatabase);
  beforeEach(async () => {
    await clearDatabase();
    token = await signup('owner@example.com');
    otherToken = await signup('other@example.com');
  });

  it('allows anonymous availability but requires authentication for reservations', async () => {
    await request(app).get(`${BASE}/availability`).expect(200);
    await request(app).get(BASE).expect(401);
    await request(app).post(BASE).send(input()).expect(401);
  });

  it('stores the signed-in user, canonical SAST instant and five-minute due date', async () => {
    const before = Date.now();
    const booking = await reserve({ user: '000000000000000000000000' });
    assert.equal(booking.scheduledFor, `${input().serviceDate}T06:00:00.000Z`);
    assert.ok(Date.parse(booking.confirmationDueAt) >= before + QUIET_PERIOD_MS);
    assert.equal(booking.passengers, 2);
    const stored = await Booking.findById(booking._id).populate('user');
    assert.equal(stored.user.email, 'owner@example.com');
    const availability = (await request(app).get(`${BASE}/availability`).expect(200)).body;
    assert.deepEqual(Object.keys(availability), ['taken']);
    assert.deepEqual(availability.taken, [booking.scheduledFor]);
  });

  it('lets only one simultaneous request reserve the same hour', async () => {
    const responses = await Promise.all([
      authed('post').send(input()), authed('post', BASE, otherToken).send(input()),
    ]);
    assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409]);
    assert.equal(await Booking.countDocuments(), 1);
  });

  it('rejects invalid counts, dates, hours, past slots and dates outside the seven-day window', async () => {
    for (const passengers of [0, 4, 1.5, '2']) await authed('post').send(input({ passengers })).expect(400);
    for (const startHour of [4, 26, 5.5, '8']) await authed('post').send(input({ startHour })).expect(400);
    await authed('post').send(input({ serviceDate: dateAfter(today(), 7) })).expect(400);
    await authed('post').send(input({ serviceDate: '2026-02-30' })).expect(400);
    assert.match(validateBooking({ ...contact, serviceDate: '2026-11-02', startHour: 5, passengers: 1 }, new Date('2026-11-02T04:00:00Z')).error, /already started/);
    assert.equal(await Booking.countDocuments(), 0);
  });

  it('assigns 01:00–02:00 to the following calendar morning', () => {
    const { value } = validateBooking({ ...contact, serviceDate: '2026-12-31', startHour: 25, passengers: 3 }, new Date('2026-12-31T10:00:00Z'));
    assert.equal(value.scheduledFor.toISOString(), '2026-12-31T23:00:00.000Z');
  });

  it('lists and permits changes only for the owner; ignores injected email and status', async () => {
    const booking = await reserve({ status: 'confirmed', confirmationSentAt: new Date(), email: 'hijack@example.com' });
    assert.equal(booking.status, 'pending');
    assert.equal((await authed('get', BASE, otherToken).expect(200)).body.bookings.length, 0);
    await authed('put', `${BASE}/${booking._id}`, otherToken).send({ ...input(), revision: 1 }).expect(404);
    await authed('delete', `${BASE}/${booking._id}?revision=1`, otherToken).expect(404);
  });

  it('restarts confirmation after an edit and refuses stale revisions', async () => {
    const booking = await reserve();
    await makeDue(booking._id);
    const updated = (await authed('put', `${BASE}/${booking._id}`).send({ ...input({ passengers: 3 }), revision: 1 }).expect(200)).body.booking;
    assert.equal(updated.revision, 2);
    assert.equal(updated.passengers, 3);
    assert.ok(Date.parse(updated.confirmationDueAt) > Date.now() + QUIET_PERIOD_MS - 1000);
    await authed('put', `${BASE}/${booking._id}`).send({ ...input(), revision: 1 }).expect(409);
    await authed('delete', `${BASE}/${booking._id}?revision=1`).expect(409);
    const transport = fakeMail();
    assert.equal(await processDueBookings({ transport }), 0);
    assert.equal(transport.messages.length, 0);
  });

  it('sends no mail before five minutes; sends once to the account email when unchanged', async () => {
    const booking = await reserve();
    const transport = fakeMail();
    const due = Date.parse(booking.confirmationDueAt);
    assert.equal(await processDueBookings({ transport, now: new Date(due - 1) }), 0);
    assert.equal(await processDueBookings({ transport, now: new Date(due + 1), from: 'bookings@example.com' }), 1);
    assert.equal(transport.messages[0].to, 'owner@example.com');
    assert.match(transport.messages[0].text, /Travellers: 2/);
    assert.equal(transport.messages[1].to, 'bookings@example.com');
    assert.equal((await Booking.findById(booking._id)).status, 'confirmed');
    assert.equal(await processDueBookings({ transport }), 0);
    assert.equal(transport.messages.length, 2);
  });

  it('allows edits after confirmation and confirms the new revision after another quiet period', async () => {
    const booking = await reserve();
    const transport = fakeMail();
    await makeDue(booking._id);
    await processDueBookings({ transport });
    const edited = (await authed('put', `${BASE}/${booking._id}`).send({ ...input({ passengers: 1 }), revision: 1 }).expect(200)).body.booking;
    assert.equal(edited.status, 'pending');
    assert.equal(edited.confirmationSentAt, undefined);
    assert.equal(await processDueBookings({ transport }), 0);
    await makeDue(booking._id);
    await processDueBookings({ transport });
    assert.equal(transport.messages.length, 4);
    assert.equal(new Set(transport.messages.map((message) => message.messageId)).size, 4);
    assert.match(transport.messages[2].subject, /updated/);
  });

  it('leases a revision while mailing; simultaneous workers do not duplicate sends', async () => {
    const booking = await reserve();
    await makeDue(booking._id);
    let sends = 0;
    const transport = { sendMail: async () => {
      sends++;
      await authed('put', `${BASE}/${booking._id}`).send({ ...input({ passengers: 3 }), revision: 1 }).expect(409);
      await authed('delete', `${BASE}/${booking._id}?revision=1`).expect(409);
    } };
    await Promise.all([processDueBookings({ transport }), processDueBookings({ transport })]);
    assert.equal(sends, 2);
  });

  it('recovers a delivery claimed by a worker that crashed', async () => {
    const booking = await reserve();
    await makeDue(booking._id);
    await Booking.updateOne({ _id: booking._id }, { $set: { notificationState: 'sending', claimId: 'dead-worker', leaseUntil: new Date(0) } });
    const transport = fakeMail();
    assert.equal(await processDueBookings({ transport }), 1);
    assert.equal(transport.messages.length, 2);
  });

  it('queues SMTP failures for retry rather than marking them confirmed', async () => {
    const booking = await reserve();
    await makeDue(booking._id);
    const transport = { sendMail: async () => { throw Object.assign(new Error('test failure'), { code: 'TEST_SMTP' }); } };
    assert.equal(await processDueBookings({ transport }), 0);
    const stored = await Booking.findById(booking._id);
    assert.equal(stored.notificationState, 'pending');
    assert.equal(stored.status, 'pending');
    assert.ok(stored.confirmationDueAt > new Date());
  });

  it('requires a WhatsApp number, pickup and drop-off, and stores the normalised details', async () => {
    for (const whatsapp of [undefined, '', '12345', 'call me', 27821234567]) await authed('post').send(input({ whatsapp })).expect(400);
    for (const place of [undefined, null, 'Rosebank', {}, { address: ' ' }, { address: 'x'.repeat(301) },
      { address: 'Rosebank', lat: 91, lng: 0 }, { address: 'Rosebank', lat: -26 }, { address: 'Rosebank', placeId: '<script>' }]) {
      await authed('post').send(input({ pickup: place })).expect(400);
      await authed('post').send(input({ dropoff: place })).expect(400);
    }
    assert.equal(await Booking.countDocuments(), 0);
    const booking = await reserve({ whatsapp: '+27 (82) 123-4567', dropoff: { address: '  Sandton   City ', extra: 'ignored' } });
    assert.equal(booking.whatsapp, '+27821234567');
    assert.deepEqual(booking.pickup, contact.pickup);
    assert.deepEqual(booking.dropoff, { address: 'Sandton City' });
    const edited = (await authed('put', `${BASE}/${booking._id}`).send({ ...input({ pickup: { address: 'Melrose Arch' } }), revision: 1 }).expect(200)).body.booking;
    assert.deepEqual(edited.pickup, { address: 'Melrose Arch' });
    assert.equal(edited.whatsapp, '0821234567');
    await authed('put', `${BASE}/${booking._id}`).send({ ...input({ whatsapp: '' }), revision: 2 }).expect(400);
  });

  it('sends designed HTML emails with the journey details to the member and to Toni', async () => {
    const booking = await reserve({ pickup: { address: 'Tom & Jerry’s <Diner>, Rosebank' } });
    await makeDue(booking._id);
    const transport = fakeMail();
    await processDueBookings({ transport, from: 'bookings@example.com', notifyTo: 'toni@example.com' });
    const [member, owner] = transport.messages;
    assert.equal(member.subject, 'Your lift club booking is confirmed');
    for (const body of [member.text, member.html]) {
      assert.ok(body.includes('Please allow Toni to confirm the details with you on WhatsApp.'));
      assert.ok(body.includes('0821234567'));
      assert.ok(body.includes('OR Tambo International Airport'));
    }
    assert.ok(member.html.includes('Tom &amp; Jerry’s &lt;Diner&gt;, Rosebank'));
    assert.ok(!member.html.includes('<Diner>'));
    assert.ok(member.html.includes('https://www.toniribeiro.com/email/lift-club-hero.jpg'));
    assert.ok(!/<img [^>]*src="http:\/\/(localhost|127\.)/.test(member.html));
    assert.equal((member.html.match(/<img /g) || []).length, (member.html.match(/<img [^>]*alt="[^"]+"/g) || []).length);
    assert.equal(owner.to, 'toni@example.com');
    assert.equal(owner.replyTo, 'owner@example.com');
    assert.match(owner.subject, /^New lift club booking/);
    assert.ok(owner.html.includes('https://wa.me/27821234567'));
    assert.ok(owner.html.includes('owner@example.com'));
    assert.ok(owner.text.includes('https://www.google.com/maps/dir/?api=1'));
  });

  it('retries only the outstanding message when the notification to Toni fails', async () => {
    const booking = await reserve();
    await makeDue(booking._id);
    const sent = [];
    let failOwner = true;
    const transport = { sendMail: async (message) => {
      if (message.to === 'toni@example.com' && failOwner) throw Object.assign(new Error('test failure'), { code: 'TEST_SMTP' });
      sent.push(message.to);
    } };
    assert.equal(await processDueBookings({ transport, notifyTo: 'toni@example.com' }), 0);
    assert.equal((await Booking.findById(booking._id)).status, 'pending');
    failOwner = false;
    await makeDue(booking._id);
    assert.equal(await processDueBookings({ transport, notifyTo: 'toni@example.com' }), 1);
    assert.deepEqual(sent, ['owner@example.com', 'toni@example.com']);
  });

  it('cancels a booking, releases its slot and prevents the queued email', async () => {
    const booking = await reserve();
    await makeDue(booking._id);
    await authed('delete', `${BASE}/${booking._id}?revision=1`).expect(200);
    assert.deepEqual((await request(app).get(`${BASE}/availability`)).body.taken, []);
    assert.equal(await processDueBookings({ transport: fakeMail() }), 0);
    await reserve();
  });

  it('removes bookings and pending mail when the user deletes their account', async () => {
    await reserve();
    await authed('delete', '/api/ribeiro/user/me').expect(200);
    assert.equal(await Booking.countDocuments(), 0);
    await authed('post').send(input()).expect(401);
  });
});
