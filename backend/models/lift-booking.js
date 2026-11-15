const mongoose = require('mongoose');

const place = new mongoose.Schema({
  address: { type: String, required: true, trim: true, minlength: 3, maxlength: 300 },
  placeId: { type: String, maxlength: 300 },
  lat: { type: Number, min: -90, max: 90 },
  lng: { type: Number, min: -180, max: 180 },
}, { _id: false });

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'RibeiroUser', required: true, index: true },
  serviceDate: { type: String, required: true },
  startHour: { type: Number, required: true, min: 5, max: 25 },
  scheduledFor: { type: Date, required: true },
  passengers: { type: Number, required: true, min: 1, max: 3 },
  // Required by the API for every new or edited booking. Optional here only so that
  // reservations made before these fields existed remain readable.
  whatsapp: { type: String, match: /^\+?\d{7,15}$/ },
  pickup: place,
  dropoff: place,
  revision: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'confirmed'], default: 'pending' },
  confirmationDueAt: { type: Date, required: true },
  confirmationSentAt: Date,
  notificationState: { type: String, enum: ['pending', 'sending', 'sent'], default: 'pending' },
  // Revisions already mailed, so a retry never repeats a message that was accepted.
  customerMailedRevision: Number,
  ownerMailedRevision: Number,
  claimId: String,
  leaseUntil: Date,
}, { timestamps: true });

// The database arbitrates simultaneous requests, including from multiple server instances.
schema.index({ scheduledFor: 1 }, { unique: true });
schema.index({ notificationState: 1, confirmationDueAt: 1 });

module.exports = mongoose.model('LiftBooking', schema);
