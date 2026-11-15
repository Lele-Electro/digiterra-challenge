const nodemailer = require('nodemailer');

function mailSettings(env = process.env) {
  // A dedicated mailbox must never inherit the password for another app's SMTP user.
  const dedicated = ['HOST', 'PORT', 'USER', 'PASSWORD'].some((key) => env[`RIBEIRO_SMTP_${key}`]);
  const prefix = dedicated ? 'RIBEIRO_SMTP_' : 'SMTP_';
  const host = env[`${prefix}HOST`] || 'mail.toniribeiro.co.za';
  const port = Number(env[`${prefix}PORT`] || 465);
  const user = env[`${prefix}USER`] || 'bookings@toniribeiro.co.za';
  const password = env[`${prefix}PASSWORD`];
  const from = env.RIBEIRO_EMAIL_FROM || user;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP port.');
  if (!password) return null;
  const replyTo = env.RIBEIRO_EMAIL_REPLY_TO;
  return { host, port, user, password, from, ...(replyTo ? { replyTo } : {}) };
}

function createMailTransport(env = process.env) {
  const settings = mailSettings(env);
  if (!settings) return null;
  const { host, port, user, password } = settings;
  return nodemailer.createTransport({
    host, port, secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass: password },
    tls: { minVersion: 'TLSv1.2', servername: host },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 45000,
    logger: false, debug: false,
  }, settings.replyTo ? { replyTo: settings.replyTo } : undefined);
}

module.exports = { mailSettings, createMailTransport };
