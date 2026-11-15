const { it } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join, resolve, sep } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

it('loads an explicit env file from a different cwd without replacing platform-provided variables', () => {
  const folder = mkdtempSync(join(tmpdir(), 'ribeiro-env-test-'));
  try {
    const file = join(folder, '.env');
    writeFileSync(file, 'RIBEIRO_ENV_TEST_LOCAL=from-file\nRIBEIRO_ENV_TEST_PLATFORM=from-file\n');
    const script = `const {loadRuntimeEnvironment} = require(${JSON.stringify(require.resolve('../config/runtime-env'))});
      loadRuntimeEnvironment(${JSON.stringify(file)});
      if (process.env.RIBEIRO_ENV_TEST_LOCAL !== 'from-file' || process.env.RIBEIRO_ENV_TEST_PLATFORM !== 'from-platform') process.exit(1);`;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: folder, env: { ...process.env, RIBEIRO_ENV_TEST_PLATFORM: 'from-platform' },
      encoding: 'utf8', windowsHide: true,
    });
    assert.equal(result.status, 0);
  } finally {
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    rmSync(folder, { recursive: true, force: true });
  }
});
