// Starts json-server on a throwaway copy of db.json, so experimenting in the app never dirties
// the committed seed file. Stop the server and run `npm run api` again to reset the data.
// Run: npm run api   (serves http://localhost:3000; hosts set PORT, and HOST=0.0.0.0 to accept outside traffic)
import { copyFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bin = require.resolve('json-server/lib/cli/bin.js');
const seed = new URL('./db.json', import.meta.url);
const runtime = new URL('./.db.runtime.json', import.meta.url);

copyFileSync(seed, runtime);
const child = spawn(process.execPath, [bin, '--host', process.env.HOST ?? 'localhost', '--port', process.env.PORT ?? '3000', runtime.pathname.replace(/^\/(\w:)/, '$1')], {
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 0));
