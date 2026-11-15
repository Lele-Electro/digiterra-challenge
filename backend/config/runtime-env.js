const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

// Resolve from the backend repository, not the shell's working directory.
// Platform-provided variables take precedence over the ignored local file.
function loadRuntimeEnvironment(envFile = resolve(__dirname, '../../.env')) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

loadRuntimeEnvironment();
module.exports = { loadRuntimeEnvironment };
