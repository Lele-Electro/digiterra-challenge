const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mailSettings, createMailTransport } = require('../services/ribeiro-mail');

describe('Ribeiro SMTP configuration', () => {
  it('uses implicit TLS for the supplied mailbox on port 465', () => {
    const transport = createMailTransport({ RIBEIRO_SMTP_PASSWORD: 'test-only-secret' });
    assert.equal(transport.options.host, 'mail.toniribeiro.co.za');
    assert.equal(transport.options.port, 465);
    assert.equal(transport.options.secure, true);
    assert.equal(transport.options.auth.user, 'bookings@toniribeiro.co.za');
    assert.equal(transport.options.tls.minVersion, 'TLSv1.2');
    assert.notEqual(transport.options.tls.rejectUnauthorized, false);
    transport.close();
  });
  it('requires STARTTLS if an environment uses port 587', () => {
    const transport = createMailTransport({ RIBEIRO_SMTP_PASSWORD: 'test-only-secret', RIBEIRO_SMTP_PORT: '587' });
    assert.equal(transport.options.secure, false);
    assert.equal(transport.options.requireTLS, true);
    transport.close();
  });
  it('supports a Gmail sender and an explicitly configured reply address', () => {
    const transport = createMailTransport({
      RIBEIRO_SMTP_HOST: 'smtp.gmail.com', RIBEIRO_SMTP_PORT: '465',
      RIBEIRO_SMTP_USER: 'sender@gmail.com', RIBEIRO_SMTP_PASSWORD: 'test-only-secret',
      RIBEIRO_EMAIL_FROM: 'sender@gmail.com', RIBEIRO_EMAIL_REPLY_TO: 'bookings@example.com',
    });
    assert.equal(transport.options.host, 'smtp.gmail.com');
    assert.equal(transport.options.auth.user, 'sender@gmail.com');
    assert.equal(transport._defaults.replyTo, 'bookings@example.com');
    assert.equal(transport.options.secure, true);
    transport.close();
  });
  it('retains backwards compatibility with existing SMTP variables', () => {
    const settings = mailSettings({ SMTP_HOST: 'mail.example.com', SMTP_USER: 'old@example.com', SMTP_PASSWORD: 'old-secret' });
    assert.equal(settings.user, 'old@example.com');
    assert.equal(settings.from, 'old@example.com');
  });
  it('never mixes a dedicated mailbox with another application password', () => {
    assert.equal(mailSettings({ RIBEIRO_SMTP_USER: 'bookings@toniribeiro.co.za', SMTP_USER: 'other@example.com', SMTP_PASSWORD: 'other-secret' }), null);
    const settings = mailSettings({ RIBEIRO_SMTP_PASSWORD: 'dedicated-secret', SMTP_USER: 'other@example.com', SMTP_PASSWORD: 'other-secret' });
    assert.equal(settings.user, 'bookings@toniribeiro.co.za');
    assert.equal(settings.password, 'dedicated-secret');
  });
  it('does not invent a password or accept an invalid port', () => {
    assert.equal(createMailTransport({}), null);
    assert.throws(() => mailSettings({ RIBEIRO_SMTP_PASSWORD: 'test', RIBEIRO_SMTP_PORT: 'invalid' }));
  });
});
