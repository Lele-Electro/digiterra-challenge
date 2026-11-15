const { randomBytes, randomUUID, createHash, createHmac, createCipheriv, createDecipheriv } = require('node:crypto');
const User = require('../models/user-ribeiro');
const Throttle = require('../models/auth-throttle');
const { mailSettings } = require('./ribeiro-mail');

const RESET_TTL_MS = 30 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const encryptionKey = () => createHash('sha256').update('ribeiro-password-recovery-v1:' + process.env.JWT_SECRET).digest();
function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function decryptToken(value) {
  const bytes = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
}

function trustedOrigin(req) {
  const fallback = process.env.RIBEIRO_APP_URL || 'http://localhost:4200';
  const candidates = [fallback, 'http://localhost:4200', 'http://127.0.0.1:4200',
    'https://www.toniribeiro.com', 'https://toniribeiro.com',
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')];
  const origins = candidates.map((value) => {
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
        ? url.origin : null;
    } catch { return null; }
  }).filter(Boolean);
  return origins.includes(req.get('origin')) ? req.get('origin') : origins[0];
}

// Distributed fixed-window limits. Only keyed digests are stored, never raw IPs/emails.
async function allowAttempt(scope, value, limit, windowMs, now = Date.now()) {
  const window = Math.floor(now / windowMs);
  const id = createHmac('sha256', process.env.JWT_SECRET).update(`${scope}:${value}:${window}`).digest('hex');
  let counter;
  const update = () => Throttle.findOneAndUpdate({ _id: id }, {
    $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) },
  }, { upsert: true, new: true });
  try { counter = await update(); }
  catch (error) { if (error.code !== 11000) throw error; counter = await update(); }
  return counter.count <= limit;
}
function clientAddress(req) {
  return req.app.locals.runtime === 'cloudflare' ? req.get('cf-connecting-ip') || req.ip : req.ip;
}

async function queueReset(email, appOrigin, now = new Date()) {
  const token = randomBytes(32).toString('hex');
  const reset = {
    tokenHash: hashToken(token), encryptedToken: encryptToken(token), appOrigin,
    requestedAt: now, expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    state: 'pending', nextAttemptAt: now,
  };
  await User.updateOne({ email,
    $and: [
      { $or: [{ 'passwordReset.requestedAt': { $exists: false } }, { 'passwordReset.requestedAt': { $lte: new Date(now.getTime() - 60000) } }] },
      { $or: [{ 'passwordReset.state': { $ne: 'sending' } }, { 'passwordReset.leaseUntil': { $lte: now } }] },
    ],
  }, { $set: { passwordReset: reset } });
}

async function processRecoveryEmails({ transport, from = mailSettings()?.from, now = new Date(), limit = 10 } = {}) {
  if (!transport) throw new Error('An email transport is required.');
  // Expiry removes only reset material, never the account.
  await User.updateMany({ 'passwordReset.expiresAt': { $lte: now } }, { $unset: { passwordReset: 1 } });
  let sent = 0;
  for (const field of ['passwordReset', 'passwordChangedNotice']) {
    for (let index = 0; index < limit; index++) {
      const claimId = randomUUID();
      const filter = {
        $or: [
          { [`${field}.state`]: 'pending', [`${field}.nextAttemptAt`]: { $lte: now } },
          { [`${field}.state`]: 'sending', [`${field}.leaseUntil`]: { $lte: now } },
        ],
      };
      if (field === 'passwordReset') filter[`${field}.expiresAt`] = { $gt: now };
      const user = await User.findOneAndUpdate(filter, { $set: {
        [`${field}.state`]: 'sending', [`${field}.claimId`]: claimId,
        [`${field}.leaseUntil`]: new Date(Math.max(now.getTime(), Date.now()) + LEASE_MS),
      } }, { new: true, sort: { [`${field}.nextAttemptAt`]: 1 } }).select(`email +${field}`);
      if (!user) break;
      const job = user[field];
      const claim = { _id: user._id, [`${field}.claimId`]: claimId, [`${field}.state`]: 'sending' };
      try {
        const isReset = field === 'passwordReset';
        const link = isReset
          ? `${job.appOrigin}/reset-password#token=${decryptToken(job.encryptedToken)}`
          : `${job.appOrigin}/forgot-password`;
        const subject = isReset ? 'Reset your Toni Ribeiro password' : 'Your Toni Ribeiro password was changed';
        const message = isReset
          ? 'A password reset was requested for your account. Use the link below to choose a new password. This link expires 30 minutes after the request and can be used once. If you did not request this, ignore this email. Your password has not changed.'
          : 'Your account password was changed. All previous sessions have been signed out. If you did not make this change, recover your account immediately using the link below.';
        // The link contains only an allowlisted origin and a hex token.
        const safeLink = link.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        await transport.sendMail({
          from: `"Toni Ribeiro" <${from}>`, to: user.email, subject,
          messageId: `<${isReset ? 'reset-' + job.tokenHash : 'password-changed-' + user._id + '-' + job.changedAt.getTime()}@toniribeiro.com>`,
          text: `${message}\n\n${link}\n\nToni Ribeiro`,
          html: `<p>${message}</p><p><a href="${safeLink}">${isReset ? 'Choose a new password' : 'Recover your account'}</a></p><p>Toni Ribeiro</p>`,
        });
        await User.updateOne(claim, {
          $set: { [`${field}.state`]: 'sent' },
          $unset: { [`${field}.encryptedToken`]: 1, [`${field}.claimId`]: 1, [`${field}.leaseUntil`]: 1 },
        });
        sent++;
      } catch (error) {
        await User.updateOne(claim, { $set: {
          [`${field}.state`]: 'pending', [`${field}.nextAttemptAt`]: new Date(now.getTime() + 60000),
        }, $unset: { [`${field}.claimId`]: 1, [`${field}.leaseUntil`]: 1 } });
        console.error('Account email delivery queued for retry:', error.code || error.name);
      }
    }
  }
  return sent;
}

async function nextRecoveryAt() {
  const dates = await Promise.all(['passwordReset', 'passwordChangedNotice'].flatMap((field) => [
    User.findOne({ [`${field}.state`]: 'pending' }).sort({ [`${field}.nextAttemptAt`]: 1 })
      .select(`+${field}`).lean().then((user) => user?.[field]?.nextAttemptAt),
    User.findOne({ [`${field}.state`]: 'sending' }).sort({ [`${field}.leaseUntil`]: 1 })
      .select(`+${field}`).lean().then((user) => user?.[field]?.leaseUntil),
  ]));
  const times = dates.filter(Boolean).map((date) => new Date(date).getTime());
  return times.length ? Math.min(...times) : null;
}
module.exports = { RESET_TTL_MS, hashToken, trustedOrigin, allowAttempt, clientAddress, queueReset, processRecoveryEmails, nextRecoveryAt };
