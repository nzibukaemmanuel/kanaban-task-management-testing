
import { copyFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const seed = new URL('./db.json', import.meta.url);
const runtime = new URL('./.db.runtime.json', import.meta.url);

copyFileSync(seed, runtime);

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(
  command,
  [
    'json-server',
    fileURLToPath(runtime),
    '--host',
    process.env.HOST ?? 'localhost',
    '--port',
    process.env.PORT ?? '3000',
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

child.on('exit', (code) => process.exit(code ?? 0));
