// Build-output checks. Run after `npm run build`. Append new checks to the list below.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE = '/lesson-ledger/';
const DIST = 'dist';

const read = (p) => readFileSync(join(DIST, p), 'utf8');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

class CheckError extends Error {}
const fail = (msg) => {
  throw new CheckError(msg);
};

const OLD_NAME = ['Lesson', 'Log'].join(' ');
const OLD_PATH = ['lesson', 'log'].join('-');

const checks = [
  ['C1', 'index.html root-relative URLs use the base path', () => {
    const html = read('index.html');
    const urls = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
    for (const u of urls) {
      if (u.startsWith('/') && !u.startsWith('//') && !u.startsWith(BASE)) fail(`${u} does not start with ${BASE}`);
    }
  }],
  ['C2', 'manifest fields', () => {
    if (!existsSync(join(DIST, 'manifest.webmanifest'))) fail('dist/manifest.webmanifest missing');
    const m = JSON.parse(read('manifest.webmanifest'));
    const expect = { name: 'Lesson Ledger', short_name: 'Lesson Ledger', start_url: BASE, scope: BASE, display: 'standalone', orientation: 'portrait' };
    for (const [k, v] of Object.entries(expect)) if (m[k] !== v) fail(`manifest ${k} is ${JSON.stringify(m[k])}, expected ${JSON.stringify(v)}`);
    for (const k of ['background_color', 'theme_color']) {
      if (String(m[k]).toLowerCase() !== '#f2f2f7') fail(`manifest ${k} is ${m[k]}`);
    }
  }],
  ['C3', 'sw.js exists and precaches index.html', () => {
    if (!existsSync(join(DIST, 'sw.js'))) fail('dist/sw.js missing');
    if (!read('sw.js').includes('index.html')) fail('sw.js does not mention index.html');
  }],
  ['C4', 'service-worker registration present', () => {
    if (existsSync(join(DIST, 'registerSW.js'))) return;
    const files = [join(DIST, 'index.html'), ...walk(join(DIST, 'assets'))];
    if (!files.some((f) => readFileSync(f, 'utf8').includes('serviceWorker'))) fail('no serviceWorker registration found');
  }],
  ['C5', 'no absolute http(s) URL in index.html or manifest', () => {
    for (const f of ['index.html', 'manifest.webmanifest']) {
      const m = read(f).match(/https?:\/\/[^\s"'<>]+/);
      if (m) fail(`${f} contains ${m[0]}`);
    }
  }],
  ['C6', 'old product name and path absent from text files', () => {
    for (const f of walk(DIST)) {
      if (!/\.(html|js|css|webmanifest)$/.test(f)) continue;
      const text = readFileSync(f, 'utf8');
      if (text.includes(OLD_NAME) || text.includes(OLD_PATH)) fail(`${f} contains the old product name or path`);
    }
  }],
  ['C7', 'a JS bundle contains the database name', () => {
    const found = walk(join(DIST, 'assets')).some((f) => f.endsWith('.js') && readFileSync(f, 'utf8').includes('lesson-ledger-v1'));
    if (!found) fail('lesson-ledger-v1 not found in dist/assets/*.js');
  }],
];

let passed = 0;
try {
  if (!existsSync(DIST)) fail('dist/ not found; run npm run build first');
  for (const [id, desc, run] of checks) {
    try {
      run();
    } catch (e) {
      if (e instanceof CheckError) throw new CheckError(`${id}: ${e.message}`);
      throw e;
    }
    passed++;
    console.log(`ok ${id} ${desc}`);
  }
  console.log(`check-dist: OK (${passed} checks)`);
} catch (e) {
  if (!(e instanceof CheckError)) throw e;
  console.error(`CHECK FAILED ${e.message}`);
  process.exit(1);
}
