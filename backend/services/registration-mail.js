const { randomUUID } = require('node:crypto');
const User = require('../models/user-ribeiro');
const { mailSettings } = require('./ribeiro-mail');

// Save this alongside the new account so a restart cannot lose its welcome email.
function registrationEmail(appOrigin, now = new Date()) {
  return { state: 'pending', queuedAt: now, nextAttemptAt: now, appOrigin };
}

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

async function processRegistrationEmails({ transport, from = mailSettings()?.from, now = new Date(), limit = 10 } = {}) {
  if (!transport) throw new Error('An email transport is required.');
  let sent = 0;
  for (let index = 0; index < limit; index++) {
    const claimId = randomUUID();
    const user = await User.findOneAndUpdate({
      $or: [
        { 'registrationEmail.state': 'pending', 'registrationEmail.nextAttemptAt': { $lte: now } },
        { 'registrationEmail.state': 'sending', 'registrationEmail.leaseUntil': { $lte: now } },
      ],
    }, { $set: {
      'registrationEmail.state': 'sending', 'registrationEmail.claimId': claimId,
      'registrationEmail.leaseUntil': new Date(Math.max(Date.now(), now.getTime()) + 2 * 60000),
    } }, { new: true, sort: { 'registrationEmail.nextAttemptAt': 1 } }).select('email name +registrationEmail');
    if (!user) break;
    const claim = { _id: user._id, 'registrationEmail.state': 'sending', 'registrationEmail.claimId': claimId };
    const link = `${user.registrationEmail.appOrigin}/lift-club`;
    try {
      await transport.sendMail({
        from: `"Toni Ribeiro" <${from}>`, to: user.email,
        subject: 'Welcome to Toni Ribeiro',
        messageId: `<registration-${user._id}@toniribeiro.com>`,
        text: `Hi ${user.name},\n\nWelcome to Toni Ribeiro! Your account has been created.\n\nYou can now book lift club seats and consultations, and manage your bookings from My Schedule.\n\nExplore the lift club: ${link}\n\nIf you did not create this account, please contact ${from}.\n\nToni Ribeiro`,
        html: `<p>Hi ${escapeHtml(user.name)},</p><p>Welcome to Toni Ribeiro! Your account has been created.</p><p>You can now book lift club seats and consultations, and manage your bookings from My Schedule.</p><p><a href="${escapeHtml(link)}">Explore the lift club</a></p><p>If you did not create this account, please contact ${escapeHtml(from)}.</p><p>Toni Ribeiro</p>`,
      });
      await User.updateOne(claim, { $set: { 'registrationEmail.state': 'sent', 'registrationEmail.sentAt': new Date() },
        $unset: { 'registrationEmail.claimId': 1, 'registrationEmail.leaseUntil': 1 } });
      sent++;
    } catch (error) {
      await User.updateOne(claim, { $set: { 'registrationEmail.state': 'pending', 'registrationEmail.nextAttemptAt': new Date(now.getTime() + 60000) },
        $unset: { 'registrationEmail.claimId': 1, 'registrationEmail.leaseUntil': 1 } });
      console.error('Registration email queued for retry:', error.code || error.name);
    }
  }
  return sent;
}

async function nextRegistrationAt() {
  const [pending, sending] = await Promise.all([
    User.findOne({ 'registrationEmail.state': 'pending' }).sort({ 'registrationEmail.nextAttemptAt': 1 }).select('+registrationEmail').lean(),
    User.findOne({ 'registrationEmail.state': 'sending' }).sort({ 'registrationEmail.leaseUntil': 1 }).select('+registrationEmail').lean(),
  ]);
  const times = [pending?.registrationEmail?.nextAttemptAt, sending?.registrationEmail?.leaseUntil]
    .filter(Boolean).map((date) => new Date(date).getTime());
  return times.length ? Math.min(...times) : null;
}
module.exports = { registrationEmail, processRegistrationEmails, nextRegistrationAt };
