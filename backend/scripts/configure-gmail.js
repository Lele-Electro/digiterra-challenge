require('../config/runtime-env');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { createMailTransport } = require('../services/ribeiro-mail');

async function main() {
  const userIndex = process.argv.indexOf('--user');
  const user = (userIndex >= 0 ? process.argv[userIndex + 1] : process.env.GMAIL_SMTP_USER || '').trim().toLowerCase();
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) throw new Error('Pass the Gmail address with --user.');
  if (!/^[A-Za-z0-9]{16}$/.test(password)) throw new Error('Add the Gmail app password to GMAIL_APP_PASSWORD in the ignored .env.');
  const root = resolve(__dirname, '../..');
  const file = resolve(root, '.env');
  const updates = {
    RIBEIRO_SMTP_HOST: 'smtp.gmail.com', RIBEIRO_SMTP_PORT: '465',
    RIBEIRO_SMTP_USER: user, RIBEIRO_SMTP_PASSWORD: password, RIBEIRO_EMAIL_FROM: user,
    RIBEIRO_EMAIL_REPLY_TO: user,
  };
  const transport = createMailTransport(updates);
  try { await transport.verify(); }
  finally { transport.close(); }
  console.log('Gmail SMTP authentication verified.');

  let content = readFileSync(file, 'utf8');
  const set = (key, value) => {
    const pattern = new RegExp('^' + key + '=.*$', 'gm');
    const line = key + '=' + JSON.stringify(value);
    content = pattern.test(content) ? content.replace(pattern, () => line) : content.trimEnd() + '\n' + line + '\n';
  };
  // Retain the existing mailbox configuration in the same ignored file for rollback.
  if (process.env.RIBEIRO_SMTP_HOST !== 'smtp.gmail.com') {
    for (const suffix of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM']) {
      const value = process.env['RIBEIRO_' + suffix];
      if (value) set('AFRIHOST_' + suffix, value);
    }
  }
  for (const [key, value] of Object.entries(updates)) set(key, value);
  writeFileSync(file, content, { mode: 0o600 });
  console.log('Ignored local SMTP settings updated; previous mailbox settings retained for rollback.');

  if (process.argv.includes('--deploy')) {
    const cli = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
    const result = spawnSync(process.execPath, [cli, 'secret', 'bulk', '--name', 'digiterra-backend'], {
      cwd: root, input: JSON.stringify(updates), encoding: 'utf8', windowsHide: true,
    });
    // Keep provider responses and all secret input out of logs.
    if (result.status !== 0) throw new Error('Cloudflare SMTP secret update failed.');
    console.log('Cloudflare SMTP secrets updated.');
    const deployment = spawnSync(process.execPath, [cli, 'deploy', '--durable-objects-code-update-mode', 'immediate'], {
      cwd: root, encoding: 'utf8', windowsHide: true,
    });
    if (deployment.status !== 0) throw new Error('Cloudflare deployment failed; local Gmail settings are ready.');
    const version = deployment.stdout.match(/Current Version ID:\s*([\w-]+)/)?.[1];
    console.log('Cloudflare backend deployed' + (version ? ': ' + version : '.'));
  }
}
main().catch((error) => {
  console.error('Gmail configuration failed:', error.code || error.message);
  process.exitCode = 1;
});
