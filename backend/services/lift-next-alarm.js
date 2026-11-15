const LiftBooking = require('../models/lift-booking');

async function nextConfirmationAt() {
  const [pending, sending] = await Promise.all([
    LiftBooking.findOne({ notificationState: 'pending' }).sort({ confirmationDueAt: 1 }).select('confirmationDueAt').lean(),
    LiftBooking.findOne({ notificationState: 'sending' }).sort({ leaseUntil: 1 }).select('leaseUntil').lean(),
  ]);
  const times = [pending?.confirmationDueAt, sending?.leaseUntil].filter(Boolean).map((time) => new Date(time).getTime());
  return times.length ? Math.min(...times) : null;
}
module.exports = { nextConfirmationAt };
