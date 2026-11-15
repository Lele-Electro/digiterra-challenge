const { resolve } = require('node:path');
require('esbuild').build({
  entryPoints: [resolve(__dirname, 'runtime.cjs')],
  outfile: resolve(__dirname, '../dist/cloudflare/app.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'es2022',
  alias: { bcrypt: 'bcryptjs' },
  sourcemap: true,
}).then(() => console.log('Cloudflare Express runtime built.')).catch(() => { process.exitCode = 1; });
