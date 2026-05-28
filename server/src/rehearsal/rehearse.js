import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runRehearsal } from './sim.js';

/**
 * Self-contained auction rehearsal. Boots its own in-memory MongoDB, seeds a
 * fresh tournament, starts the server on an isolated port, runs the full
 * 10-captain simulation (src/rehearsal/sim.js), then tears everything down.
 *
 * Uses port 4100 and its own database so it never collides with a dev server
 * running on 4000.
 *
 *   npm run rehearse
 */

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..', '..');
const PORT = process.env.REHEARSE_PORT || 4100;
const BASE = `http://localhost:${PORT}`;

function runScript(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: serverRoot, env, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

async function waitForHealth(base, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('server did not become healthy in time');
}

console.log('[rehearsal] starting in-memory MongoDB (first run downloads the engine)…');
const mem = await MongoMemoryServer.create();
const env = { ...process.env, MONGO_URI: mem.getUri('ntg-rehearsal'), PORT: String(PORT) };

let exitCode = 1;
let server;
try {
  console.log('[rehearsal] seeding a fresh tournament…');
  await runScript(join('src', 'seed', 'seed.js'), env);

  console.log(`[rehearsal] starting the server on port ${PORT}…`);
  server = spawn(process.execPath, [join('src', 'index.js')], { cwd: serverRoot, env, stdio: 'inherit' });

  await waitForHealth(BASE);
  console.log('[rehearsal] server healthy — running the 10-captain simulation\n');

  const { failures, total, sold, unsold, results } = await runRehearsal(BASE);
  const header = `REHEARSAL ${failures === 0 ? 'PASSED' : 'FAILED'} — ${total - failures}/${total} checks passed · ${sold} sold · ${unsold} unsold`;
  console.log(`\n================  ${header}  ================`);

  // Write a report file so the outcome is readable even when the console isn't.
  const lines = [
    `NTG Auction Rehearsal Report`,
    new Date().toISOString(),
    ``,
    header,
    ``,
    ...results.map((r) => `${r.ok ? '[PASS]' : '[FAIL]'} ${r.label}`),
    ``,
  ];
  try {
    writeFileSync(join(serverRoot, 'rehearsal-report.txt'), lines.join('\n'));
    console.log(`[rehearsal] report written to rehearsal-report.txt`);
  } catch (e) {
    console.log('[rehearsal] could not write report:', e.message);
  }
  exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  console.error('[rehearsal] error:', err.message);
} finally {
  try { server?.kill(); } catch {}
  try { await mem.stop(); } catch {}
  process.exit(exitCode);
}
