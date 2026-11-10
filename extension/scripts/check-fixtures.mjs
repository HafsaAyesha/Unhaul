// Checks every saved fixture in tests/fixtures/ the way Chrome would see it:
//   1. its URL is covered by the built manifest's host_permissions and content script matches,
//   2. Chrome actually injects the Unhaul content script on that URL,
//   3. src/store/extract.ts reads a product (title, price, currency) from the saved HTML.
// No network: each fixture is served at its own URL from disk. Run from extension/:
//   npm run fixtures:check          (builds first, then checks)
import { chromium } from 'playwright';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const EXT = path.resolve(process.env.UNHAUL_BUILD_DIR || path.join(ROOT, '.output', 'chrome-mv3'));
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const hostPatterns = manifest.host_permissions ?? [];
const contentPatterns = (manifest.content_scripts ?? []).flatMap((c) => c.matches);

// Chrome match pattern check for the https://host/path* patterns this extension uses.
const toRegex = (p) => {
  const m = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(p);
  if (!m) return /$^/;
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const host = m[2] === '*' ? '[^/]+' : m[2].startsWith('*.') ? `(?:[^/]+\\.)?${esc(m[2].slice(2))}` : esc(m[2]);
  return new RegExp(`^${m[1] === '*' ? 'https?' : m[1]}://${host}${esc(m[3]).replace(/\\\*/g, '.*').replace(/\*/g, '.*')}$`);
};
const matches = (url, patterns) => patterns.some((p) => toRegex(p).test(url));

// The fixture's real URL: fixtures/manifest.json entry, else the page's og:url or JSON-LD Product url.
const saved = fs.existsSync(path.join(FIXTURES, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf8')) : [];
const urlFor = (file, html) => {
  const entry = saved.find((m) => m.file === file);
  if (entry?.url) return entry.url;
  const og = /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i.exec(html)?.[1];
  const ld = /"@type"\s*:\s*"Product(?:Group)?"[\s\S]{0,4000}?"url"\s*:\s*"(https?:[^"]+\/products\/[^"?]+)/.exec(html)?.[1];
  const candidate = [og, ld].find((u) => u && /\/products\//.test(u));
  return candidate ? candidate.split(/[?#]/)[0] : og ?? null;
};

// Bundle the real product reader so the browser runs exactly the extension's code.
const bundle = (await build({
  entryPoints: [path.join(ROOT, 'src', 'store', 'extract.ts')], bundle: true, write: false,
  format: 'iife', globalName: 'UnhaulExtract', platform: 'browser', logLevel: 'silent',
})).outputFiles[0].text;

const files = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.html')).sort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'unhaul-fixtures-'));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROMIUM_PATH || undefined,
  channel: process.env.CHROMIUM_PATH ? undefined : 'chromium', // full Chromium; extensions need it
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
const extensionId = new URL(worker.url()).host;

const rows = [];
try {
  for (const file of files) {
    const html = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
    const url = urlFor(file, html);
    const row = { fixture: file.slice(0, 44), url: url ? url.replace(/^https:\/\//, '').slice(0, 52) : '-',
      hostPerm: false, matches: false, injected: false, title: '-', price: '-', currency: '-', result: 'FAIL' };
    if (!url) { row.result = 'FAIL: no URL in fixture'; rows.push(row); continue; }
    row.hostPerm = matches(url, hostPatterns);
    row.matches = matches(url, contentPatterns);

    const page = await context.newPage();
    // Serve the saved HTML at its real URL; block every other request so the test is offline.
    await page.route('**/*', (route) => route.request().url() === url
      ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: html })
      : route.abort());
    const cdp = await context.newCDPSession(page);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', (e) => worlds.push(e.context));
    await cdp.send('Runtime.enable');
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      row.injected = worlds.some((w) => w.origin === `chrome-extension://${extensionId}` || w.name.includes(extensionId));
      await page.addScriptTag({ content: bundle });
      const product = await page.evaluate(() => window.UnhaulExtract.extractProduct(document, location.href));
      if (product) Object.assign(row, { title: String(product.title).slice(0, 30), price: product.price, currency: product.currency });
      const reads = product && product.title;
      // The reader leaves price empty when variants differ in price rather than guess.
      const priced = reads && typeof product.price === 'number' && product.currency;
      if (row.hostPerm && row.matches && row.injected && reads) row.result = priced ? 'PASS' : 'PASS (price empty: variants differ)';
      else row.result = `FAIL: ${[!row.hostPerm && 'not in host_permissions', !row.matches && 'not in content matches',
        !row.injected && 'content script not injected', !reads && 'reader found no product']
        .filter(Boolean).join(', ')}`;
    } catch (e) {
      row.result = `ERROR: ${String(e.message).split('\n')[0].slice(0, 60)}`;
    }
    await cdp.detach().catch(() => {});
    await page.close();
    rows.push(row);
  }
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

console.table(rows);
const failed = rows.filter((r) => !r.result.startsWith('PASS')).length;
console.log(`\n${rows.length - failed}/${rows.length} fixtures PASS (build: ${EXT})`);
process.exitCode = failed ? 1 : 0;
