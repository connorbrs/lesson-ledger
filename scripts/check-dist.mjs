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

// Parse PNG IHDR: width at 16, height at 20, bit depth at 24, color type at 25.
function pngInfo(path) {
  const b = readFileSync(path);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (b.length < 26 || !b.subarray(0, 8).equals(sig)) fail(`${path} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], colorType: b[25] };
}

// Resolve a URL found in the build output against the site origin and base path.
const resolveUnderBase = (url, from = BASE) => new URL(url, `https://example.invalid${from}`).pathname;

const metaContent = (html, attr, name) => {
  const tag = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`${attr}="${name}"`));
  return tag?.match(/\bcontent="([^"]*)"/)?.[1];
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
  ['C8', 'apple-touch-icon link resolves under the base path and the PNG is 180x180 RGB', () => {
    const html = read('index.html');
    const tag = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).find((t) => /rel="apple-touch-icon"/.test(t));
    if (!tag) fail('no apple-touch-icon link');
    const href = tag.match(/\bhref="([^"]*)"/)?.[1];
    if (resolveUnderBase(href) !== `${BASE}apple-touch-icon.png`) fail(`apple-touch-icon href is ${href}`);
    if (!existsSync(join(DIST, 'apple-touch-icon.png'))) fail('dist/apple-touch-icon.png missing');
    const i = pngInfo(join(DIST, 'apple-touch-icon.png'));
    if (i.w !== 180 || i.h !== 180 || i.depth !== 8 || i.colorType !== 2) fail(`apple-touch-icon.png is ${JSON.stringify(i)}`);
  }],
  ['C9', 'icon-512.png is 512x512 RGB and listed in the manifest under the base path', () => {
    if (!existsSync(join(DIST, 'icons/icon-512.png'))) fail('dist/icons/icon-512.png missing');
    const i = pngInfo(join(DIST, 'icons/icon-512.png'));
    if (i.w !== 512 || i.h !== 512 || i.depth !== 8 || i.colorType !== 2) fail(`icon-512.png is ${JSON.stringify(i)}`);
    const m = JSON.parse(read('manifest.webmanifest'));
    const entry = (m.icons ?? []).find((ic) => resolveUnderBase(ic.src, `${BASE}manifest.webmanifest`) === `${BASE}icons/icon-512.png`);
    if (!entry) fail('manifest icons has no entry resolving to /lesson-ledger/icons/icon-512.png');
    if (entry.sizes !== '512x512' || entry.type !== 'image/png') fail(`manifest icon entry is ${JSON.stringify(entry)}`);
  }],
  ['C10', 'sw.js precaches the icons', () => {
    const sw = read('sw.js');
    for (const f of ['apple-touch-icon.png', 'icons/icon-512.png']) if (!sw.includes(f)) fail(`sw.js does not reference ${f}`);
  }],
  ['C11', 'iOS head tags present', () => {
    const html = read('index.html');
    const want = [
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-title', 'Lesson Ledger'],
      ['apple-mobile-web-app-status-bar-style', 'default'],
    ];
    for (const [name, value] of want) {
      if (metaContent(html, 'name', name) !== value) fail(`meta ${name} is not "${value}"`);
    }
    if (!metaContent(html, 'name', 'viewport')?.includes('viewport-fit=cover')) fail('viewport lacks viewport-fit=cover');
    const themes = [...html.matchAll(/<meta\b[^>]*name="theme-color"[^>]*>/g)].map((m) => m[0]);
    const has = (scheme, color) => themes.some((t) => t.includes(`(prefers-color-scheme: ${scheme})`) && t.toLowerCase().includes(`content="${color}"`));
    if (!has('light', '#f2f2f7')) fail('missing light theme-color #F2F2F7');
    if (!has('dark', '#000000')) fail('missing dark theme-color #000000');
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
