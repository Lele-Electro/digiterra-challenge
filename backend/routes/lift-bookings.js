const express = require('express');
const mongoose = require('mongoose');
const LiftBooking = require('../models/lift-booking');
const checkAuth = require('../middleware/ribeiro-auth');
const { QUIET_PERIOD_MS, today, dateAfter, validateBooking } = require('../services/lift-schedule');
const router = express.Router();

const publicBooking = (booking) => ({
  _id: booking._id, serviceDate: booking.serviceDate, startHour: booking.startHour,
  scheduledFor: booking.scheduledFor, passengers: booking.passengers,
  whatsapp: booking.whatsapp, pickup: booking.pickup, dropoff: booking.dropoff,
  revision: booking.revision, status: booking.status,
  confirmationDueAt: booking.confirmationDueAt, confirmationSentAt: booking.confirmationSentAt,
});

const handleError = (res, error) => {
  if (error.code === 11000) return res.status(409).json({ message: 'This slot was just taken. Please choose another time.' });
  if (error instanceof mongoose.Error.ValidationError) return res.status(400).json({ message: 'Invalid booking details.' });
  console.error('Lift booking request failed:', error.name);
  return res.status(500).json({ message: 'Unable to save your booking. Please try again.' });
};

// Only occupied times are public: never expose names, emails, IDs or passenger counts.
router.get('/availability', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const first = today();
    const bookings = await LiftBooking.find({ serviceDate: { $gte: first, $lte: dateAfter(first, 6) } })
      .select('scheduledFor -_id').lean();
    res.json({ taken: bookings.map((booking) => booking.scheduledFor.toISOString()) });
  } catch (error) { handleError(res, error); }
});

router.use(checkAuth);
router.use(async (req, res, next) => {
  try {
    if (!await require('../models/user-ribeiro').exists({ _id: req.userData.userId })) {
      return res.status(401).json({ message: 'Please sign in again.' });
    }
    next();
  } catch (error) { handleError(res, error); }
});
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/', async (req, res) => {
  try {
    const bookings = await LiftBooking.find({ user: req.userData.userId, scheduledFor: { $gt: new Date() } })
      .sort({ scheduledFor: 1 });
    res.json({ bookings: bookings.map(publicBooking) });
  } catch (error) { handleError(res, error); }
});

router.post('/', async (req, res) => {
  const now = new Date();
  const { error, value } = validateBooking(req.body, now);
  if (error) return res.status(400).json({ message: error });
  try {
    await LiftBooking.init();
    const booking = await LiftBooking.create({ ...value, user: req.userData.userId,
      confirmationDueAt: new Date(now.getTime() + QUIET_PERIOD_MS) });
    res.status(201).json({ booking: publicBooking(booking) });
  } catch (error) { handleError(res, error); }
});

// Revisions prevent stale tabs from overwriting a more recent change.
// A short lease protects the revision during actual SMTP delivery.
function editableFilter(req, revision, now) {
  return { _id: req.params.id, user: req.userData.userId, revision,
    scheduledFor: { $gt: now },
    $or: [{ notificationState: { $ne: 'sending' } }, { leaseUntil: { $lte: now } }],
  };
}

async function conflictOrMissing(req, res) {
  const exists = await LiftBooking.exists({ _id: req.params.id, user: req.userData.userId });
  return res.status(exists ? 409 : 404).json({ message: exists
    ? 'This booking changed or its confirmation is being sent. Refresh and try again.'
    : 'Booking not found.' });
}

router.put('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Booking not found.' });
  if (!Number.isInteger(req.body.revision) || req.body.revision < 1) return res.status(400).json({ message: 'A booking revision is required.' });
  const now = new Date();
  const { error, value } = validateBooking(req.body, now);
  if (error) return res.status(400).json({ message: error });
  try {
    const booking = await LiftBooking.findOneAndUpdate(editableFilter(req, req.body.revision, now), {
      $set: { ...value, status: 'pending', notificationState: 'pending',
        confirmationDueAt: new Date(now.getTime() + QUIET_PERIOD_MS) },
      $unset: { confirmationSentAt: 1, claimId: 1, leaseUntil: 1 },
      $inc: { revision: 1 },
    }, { new: true, runValidators: true });
    if (!booking) return await conflictOrMissing(req, res);
    res.json({ booking: publicBooking(booking) });
  } catch (error) { handleError(res, error); }
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Booking not found.' });
  const revision = Number(req.query.revision);
  if (!Number.isInteger(revision) || revision < 1) return res.status(400).json({ message: 'A booking revision is required.' });
  try {
    const booking = await LiftBooking.findOneAndDelete(editableFilter(req, revision, new Date()));
    if (!booking) return await conflictOrMissing(req, res);
    res.json({ message: 'Booking cancelled.' });
  } catch (error) { handleError(res, error); }
});

module.exports = router;
