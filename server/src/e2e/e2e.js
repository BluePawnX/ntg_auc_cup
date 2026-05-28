import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runE2E } from './suite.js';

/**
 * Self-contained end-to-end test. Boots its own in-memory MongoDB, seeds a
 * fresh tournament, starts the server on an isolated port (4200), runs the full
 * suite (src/e2e/suite.js), writes e2e-report.txt, and tears everything down.
 *
 *   npm run e2e
 */
const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..', '..');
const PORT = process.env.E2E_PORT || 4200;
const BASE = `http://localhost:${PORT}`;

const runScript = (script, env) => new Promise((resolve, reject) => {
  const c = spawn(process.execPath, [script], { cwd: serverRoot, env, stdio: 'inherit' });
  c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
});
async function waitForHealth(base, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 400)); }
  throw new Error('server did not become healthy');
}

console.log('[e2e] starting in-memory MongoDB…');
const mem = await MongoMemoryServer.create();
const env = { ...process.env, MONGO_URI: mem.getUri('ntg-e2e'), PORT: String(PORT) };

let exitCode = 1, server;
try {
  console.log('[e2e] seeding…');
  await runScript(join('src', 'seed', 'seed.js'), env);
  console.log(`[e2e] starting server on ${PORT}…`);
  server = spawn(process.execPath, [join('src', 'index.js')], { cwd: serverRoot, env, stdio: 'inherit' });
  await waitForHealth(BASE);
  console.log('[e2e] running the full end-to-end suite\n');

  const { results, failures } = await runE2E(BASE);
  const header = `E2E ${failures === 0 ? 'PASSED' : 'FAILED'} — ${results.length - failures}/${results.length} checks passed`;
  console.log(`\n================  ${header}  ================`);
  const lines = ['NTG Platform — End-to-End Test Report', new Date().toISOString(), '', header, '',
    ...results.map((r) => `${r.ok ? '[PASS]' : '[FAIL]'} ${r.label}`), ''];
  try { writeFileSync(join(serverRoot, 'e2e-report.txt'), lines.join('\n')); console.log('[e2e] report → e2e-report.txt'); } catch (e) { console.log('[e2e] report write failed:', e.message); }
  exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  console.error('[e2e] error:', err.message);
} finally {
  try { server?.kill(); } catch {}
  try { await mem.stop(); } catch {}
  process.exit(exitCode);
}
