const router = require('express').Router();
const bcrypt = require('bcrypt');
const User = require('../models/user-ribeiro');
const { mailSettings } = require('../services/ribeiro-mail');
const { hashToken, trustedOrigin, allowAttempt, clientAddress, queueReset } = require('../services/password-recovery');
const GENERIC_MESSAGE = 'If an account exists for that email address, a password reset link will be sent. Check your inbox and spam folder.';
const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one.';

router.post('/forgot-password', async (req, res) => {
  const started = Date.now();
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  try {
    if (!mailSettings()) return res.status(503).json({ message: 'Password recovery email is temporarily unavailable. Please try again later.' });
    if (!await allowAttempt('forgot-ip', clientAddress(req), 20, 15 * 60000)) {
      return res.set('Retry-After', '900').status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    if (await allowAttempt('forgot-email', email, 3, 60 * 60000)) {
      await queueReset(email, trustedOrigin(req));
    }
    // Equal status, body and minimum response duration for existing and unknown users.
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 350 - (Date.now() - started))));
    res.status(202).json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('Password recovery request failed:', error.name);
    res.status(503).json({ message: 'Unable to request a reset right now. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ message: INVALID_LINK });
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Use at least 8 characters and at most 72 UTF-8 bytes for your password.' });
  }
  try {
    if (!await allowAttempt('reset-ip', clientAddress(req), 30, 15 * 60000)) {
      return res.set('Retry-After', '900').status(429).json({ message: 'Too many attempts. Please try again later.' });
    }
    const filter = { 'passwordReset.tokenHash': hashToken(token), 'passwordReset.expiresAt': { $gt: new Date() } };
    const user = await User.findOne(filter).select('+passwordReset');
    if (!user) return res.status(400).json({ message: INVALID_LINK });
    const passwordHash = await bcrypt.hash(password, 12);
    // Recheck expiry and consume the token atomically: only one concurrent request wins.
    const now = new Date();
    const updated = await User.findOneAndUpdate({ ...filter, 'passwordReset.expiresAt': { $gt: now } }, {
      $set: { password: passwordHash, passwordChangedNotice: {
        changedAt: now, appOrigin: user.passwordReset.appOrigin, state: 'pending', nextAttemptAt: now,
      } },
      $inc: { authVersion: 1 }, $addToSet: { authProviders: 'password' }, $unset: { passwordReset: 1 },
    });
    if (!updated) return res.status(400).json({ message: INVALID_LINK });
    res.json({ message: 'Your password has been changed. Please sign in with your new password.' });
  } catch (error) {
    console.error('Password reset failed:', error.name);
    res.status(503).json({ message: 'Unable to change your password right now. Please try again.' });
  }
});
module.exports = router;
