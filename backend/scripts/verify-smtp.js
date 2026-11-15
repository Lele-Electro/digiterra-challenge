require('../config/runtime-env');
const { mailSettings, createMailTransport } = require('../services/ribeiro-mail');

async function main() {
  const settings = mailSettings();
  const transport = createMailTransport();
  if (!transport) throw Object.assign(new Error(), { code: 'SMTP_NOT_CONFIGURED' });
  try {
    await transport.verify();
    console.log(JSON.stringify({ status: 'SMTP_AUTHENTICATED', host: settings.host, port: settings.port, user: settings.user, tls: true }));
    // Deliberately restrict test delivery to the configured mailbox itself.
    if (process.argv.includes('--send')) {
      const result = await transport.sendMail({
        from: { name: 'Toni Ribeiro', address: settings.from },
        to: settings.user,
        subject: 'Toni Ribeiro booking email configuration test',
        text: 'This is a one-off configuration test for the Toni Ribeiro lift club booking emails. SMTP authentication and message submission have succeeded. No booking was created or changed.',
      });
      console.log(JSON.stringify({ status: 'TEST_EMAIL_ACCEPTED', accepted: result.accepted.length, rejected: result.rejected.length }));
      if (result.rejected.length || !result.accepted.length) process.exitCode = 1;
    }
  } finally { transport.close(); }
}

main().catch((error) => {
  // Do not dump transport options, provider responses or secrets.
  console.error(JSON.stringify({ status: 'SMTP_VERIFICATION_FAILED', code: error.code || error.name, command: error.command, responseCode: error.responseCode }));
  process.exitCode = 1;
});
