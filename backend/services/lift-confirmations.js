const { randomUUID } = require('node:crypto');
const { createMailTransport, mailSettings } = require('./ribeiro-mail');
const mongoose = require('mongoose');
const LiftBooking = require('../models/lift-booking');
const { TIME_ZONE } = require('./lift-schedule');
const { bookingConfirmationEmail, bookingNotificationEmail } = require('../email-templates/lift-booking-emails');

const LEASE_MS = 5 * 60 * 1000;

// A MongoDB-backed queue: a restart loses no timers, and concurrent workers claim
// different bookings. Edits atomically reset the due date and increment the revision.
// Toni receives a copy of every confirmed revision so the details can be confirmed on WhatsApp.
async function processDueBookings({ transport, now = new Date(), from = mailSettings()?.from, limit = 25,
  notifyTo = process.env.RIBEIRO_BOOKING_NOTIFY_TO || from } = {}) {
  if (!transport) throw new Error('An email transport is required.');
  let sent = 0;
  for (let index = 0; index < limit; index++) {
    const claimId = randomUUID();
    const booking = await LiftBooking.findOneAndUpdate({
      confirmationDueAt: { $lte: now },
      $or: [{ notificationState: 'pending' }, { notificationState: 'sending', leaseUntil: { $lte: now } }],
    }, { $set: { notificationState: 'sending', claimId, leaseUntil: new Date(Math.max(Date.now(), now.getTime()) + LEASE_MS) } },
    { new: true, sort: { confirmationDueAt: 1 } }).populate('user', 'email name');
    if (!booking) break;

    const claim = { _id: booking._id, revision: booking.revision, claimId, notificationState: 'sending' };
    if (!booking.user) {
      await LiftBooking.deleteOne(claim);
      continue;
    }
    try {
      const date = new Intl.DateTimeFormat('en-ZA', {
        timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(booking.scheduledFor);
      const hour = (value) => `${String(value % 24).padStart(2, '0')}:00`;
      const details = {
        name: booking.user.name, email: booking.user.email, date,
        time: `${hour(booking.startHour)} – ${hour(booking.startHour + 1)}`,
        passengers: booking.passengers, whatsapp: booking.whatsapp,
        pickup: booking.pickup, dropoff: booking.dropoff,
        reference: String(booking._id), updated: booking.revision > 1,
      };
      // Each message is recorded once accepted, so a retry after a partial failure
      // sends only the message that is still outstanding for this revision.
      if (booking.customerMailedRevision !== booking.revision) {
        await transport.sendMail({
          from: `"Toni Ribeiro" <${from}>`,
          to: booking.user.email,
          // Stable per revision, including when retrying a crashed worker.
          messageId: `<lift-${booking._id}-${booking.revision}@toniribeiro.com>`,
          ...bookingConfirmationEmail(details, { contact: from }),
        });
        await LiftBooking.updateOne(claim, { $set: { customerMailedRevision: booking.revision } });
      }
      if (notifyTo && booking.ownerMailedRevision !== booking.revision) {
        await transport.sendMail({
          from: `"Toni Ribeiro Lift Club" <${from}>`,
          to: notifyTo,
          replyTo: booking.user.email,
          messageId: `<lift-owner-${booking._id}-${booking.revision}@toniribeiro.com>`,
          ...bookingNotificationEmail(details),
        });
        await LiftBooking.updateOne(claim, { $set: { ownerMailedRevision: booking.revision } });
      }
      await LiftBooking.updateOne(claim, { $set: { notificationState: 'sent', status: 'confirmed', confirmationSentAt: new Date() },
        $unset: { claimId: 1, leaseUntil: 1 } });
      sent++;
    } catch (error) {
      // Retry later without exposing SMTP credentials or recipients in logs.
      await LiftBooking.updateOne(claim, { $set: { notificationState: 'pending', confirmationDueAt: new Date(now.getTime() + 60000) },
        $unset: { claimId: 1, leaseUntil: 1 } });
      console.error('Lift confirmation delivery failed; queued for retry:', error.code || error.name);
    }
  }
  return sent;
}

function startConfirmationWorker() {
  const transport = createMailTransport();
  if (!transport) {
    console.warn('Lift booking confirmations are queued. Configure RIBEIRO_SMTP_PASSWORD (or the existing SMTP settings) to enable delivery.');
    return () => {};
  }
  let busy = false;
  const tick = async () => {
    if (busy || mongoose.connection.readyState !== 1) return;
    busy = true;
    try {
      await require('./password-recovery').processRecoveryEmails({ transport });
      await require('./registration-mail').processRegistrationEmails({ transport });
      await processDueBookings({ transport });
    }
    catch (error) { console.error('Lift confirmation worker failed:', error.name); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 15000);
  timer.unref();
  void tick();
  return () => { clearInterval(timer); transport.close(); };
}

module.exports = { processDueBookings, startConfirmationWorker };
