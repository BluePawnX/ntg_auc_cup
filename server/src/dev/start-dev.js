import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * DEV-ONLY launcher. Boots an in-memory MongoDB (a real mongod, downloaded once
 * to a local cache), seeds the tournament into it, then starts the normal
 * server pointed at that database. Lets you run the whole stack with only
 * Node.js installed — no MongoDB install, no admin rights.
 *
 * This does NOT change the production seed/server code. On event day you'd run
 * a real MongoDB and `npm run seed && npm start` as normal.
 *
 *   npm run dev:memory
 */

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..', '..'); // .../server

function run(scriptRelPath, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptRelPath], {
      cwd: serverRoot,
      env,
      stdio: 'inherit',
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${scriptRelPath} exited with code ${code}`))
    );
  });
}

console.log('[dev] starting an in-memory MongoDB (first run downloads the engine — please wait)…');
const mem = await MongoMemoryServer.create();
const uri = mem.getUri('ntg-platform');
console.log(`[dev] in-memory MongoDB ready at ${uri}`);

// Pass the URI down via env. dotenv does not override already-set env vars,
// so the server/seed use THIS uri instead of the .env localhost value.
const env = { ...process.env, MONGO_URI: uri };

console.log('[dev] seeding the tournament…');
await run(join('src', 'seed', 'seed.js'), env);

console.log('[dev] starting the server…\n');
const server = spawn(process.execPath, [join('src', 'index.js')], {
  cwd: serverRoot,
  env,
  stdio: 'inherit',
});

async function shutdown() {
  try { server.kill(); } catch {}
  try { await mem.stop(); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('exit', shutdown);
