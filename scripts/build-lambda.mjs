import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
await mkdir('dist/lambda', { recursive: true });
await build({ entryPoints: ['src/handler.ts'], outfile: 'dist/lambda/index.mjs', bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: true, banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, external: ['pg-native'] });
await writeFile('dist/lambda/package.json', JSON.stringify({ type: 'module' }));
// Amazon RDS CA bundle: download only during build, never at Lambda startup.
const response = await fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem', { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`RDS CA download failed: ${response.status}`);
await writeFile('dist/lambda/rds-ca.pem', await response.text());
await copyFile('database/001_initial.sql', 'dist/lambda/001_initial.sql');
console.log('Lambda bundle ready: dist/lambda/index.mjs (handler: index.handler)');
