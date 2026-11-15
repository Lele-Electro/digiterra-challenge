const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator')

// Embedded outbox: issuing/consuming a reset and queuing its email is one atomic write.
const deliveryFields = {
    state: { type: String, enum: ['pending', 'sending', 'sent'], default: 'pending' },
    nextAttemptAt: Date, claimId: String, leaseUntil: Date,
};
const resetSchema = new mongoose.Schema({
    ...deliveryFields, tokenHash: String, encryptedToken: String,
    requestedAt: Date, expiresAt: Date, appOrigin: String,
}, { _id: false });
const noticeSchema = new mongoose.Schema({
    ...deliveryFields, changedAt: Date, appOrigin: String,
}, { _id: false });
const registrationSchema = new mongoose.Schema({
    ...deliveryFields, queuedAt: Date, sentAt: Date, appOrigin: String,
}, { _id: false });

const userSchema = mongoose.Schema({
    email: {type: String, required: true, unique: true, lowercase: true, trim: true},
    // bcrypt hash; absent for accounts that only ever signed in with Google
    password: {type: String, required: false},
    name: {type: String, required: true, trim: true},
    surname: {type: String, required: false, trim: true},
    phone: { type: String, required: false, trim: true, match: /^\+?\d{7,15}$/ },
    // Google's stable account identifier (the ID token "sub" claim), never the email
    googleId: {type: String, required: false},
    picture: {type: String, required: false},
    authProviders: {type: [String], enum: ['password', 'google'], default: []},
    authVersion: { type: Number, default: 0 },
    passwordReset: { type: resetSchema, select: false },
    passwordChangedNotice: { type: noticeSchema, select: false },
    registrationEmail: { type: registrationSchema, select: false },
}, { timestamps: true });

// Sparse so that the many password-only users without a googleId don't collide
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
// Never use a TTL index on this embedded expiry: it would delete the account.
userSchema.index({ 'passwordReset.tokenHash': 1 }, { sparse: true });
userSchema.index({ 'passwordReset.state': 1, 'passwordReset.nextAttemptAt': 1 });
userSchema.index({ 'passwordChangedNotice.state': 1, 'passwordChangedNotice.nextAttemptAt': 1 });
userSchema.index({ 'registrationEmail.state': 1, 'registrationEmail.nextAttemptAt': 1 });

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model('RibeiroUser', userSchema);
