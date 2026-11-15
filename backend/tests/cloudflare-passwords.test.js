const { it } = require('node:test');
const assert = require('node:assert/strict');
const nativeBcrypt = require('bcrypt');
const workerBcrypt = require('bcryptjs');

it('Cloudflare bcrypt can authenticate existing Node password hashes', async () => {
  const hash = await nativeBcrypt.hash('test-password-1234', 8);
  assert.equal(await workerBcrypt.compare('test-password-1234', hash), true);
  assert.equal(await workerBcrypt.compare('wrong-password', hash), false);
});
it('Node bcrypt can authenticate passwords created by Cloudflare', async () => {
  const hash = await workerBcrypt.hash('test-password-1234', 8);
  assert.equal(await nativeBcrypt.compare('test-password-1234', hash), true);
});
