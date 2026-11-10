// Vets candidate Pakistani stores before you save fixtures for them. Run on your own laptop
// (it opens your installed Chrome, in a fresh guest-like profile with no cookies):
//   cd extension
//   npm run stores:check                         # every store in CANDIDATES below
//   npm run stores:check -- toycompany.pk zubaidas.com
//   npm run stores:check -- --headless           # no window (more likely to be bot-blocked)
// Nothing is saved and the extension is not changed. For each store it checks:
//   robots    robots.txt does not disallow /products/ for all user agents
//   page      a product page loads (no 4xx/5xx, no bot challenge, no login or password wall)
//   path      the product URL is /products/<handle>, which the content script matches
//   ld/og/js  JSON-LD Product, Open Graph product tags, Shopify /products/<handle>.js
//   reader    src/store/extract.ts reads title + price + PKR from the live page
// PASS means all of these hold. Then save fixtures and add the domain:
//   npm run fixtures:auto -- toys_games:toycompany.pk     (saves pages to tests/fixtures/)
//   add 'toycompany.pk' to STORE_DOMAINS in src/store/stores.ts
//   npm run fixtures:check                               (checks Chrome matches + reader offline)
import { chromium } from 'playwright';
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Candidates only: popular Pakistani online shops found through public search and store
// directories. Category IDs follow src/shared/lists.ts. Edit freely.
const CANDIDATES = {
  stationery: ['stationers.pk', 'thestationerycompany.pk', 'zubaidas.com', 'rung.com.pk', 'theschoolstore.pk',
    'saleemibookdepot.com', 'artsupplies.pk', 'fineartsmaterial.pk'], // incl. art and hobby supplies
  toys_games: ['toycompany.pk', 'alsimba.pk', 'toynix.pk', 'odeez.pk', 'babybazar.pk', 'babytoys.pk', 'chasevalue.pk'],
  other: ['toobas.pk', 'giftkarte.com', 'designyourown.pk', 'blingspot.pk'], // gift shops
  home_decor: ['soz.com.pk', 'nishatlinen.com'],
};

const args = process.argv.slice(2);
const headless = args.includes('--headless');
const fromCli = args.filter((a) => !a.startsWith('--'));
const JOBS = fromCli.length
  ? fromCli.map((a) => (a.includes(':') ? a.split(':') : ['other', a])).map(([category, host]) => ({ category, host }))
  : Object.entries(CANDIDATES).flatMap(([category, hosts]) => hosts.map((host) => ({ category, host })));

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reader = (await build({
  entryPoints: [path.join(ROOT, 'src', 'store', 'extract.ts')], bundle: true, write: false,
  format: 'iife', globalName: 'UnhaulExtract', platform: 'browser', logLevel: 'silent',
})).outputFiles[0].text;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// robots.txt: is /products/ disallowed for "User-agent: *"? Returns 'ok', 'BLOCKED' or 'none'.
async function robots(origin) {
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return 'none';
    let applies = false; const rules = [];
    for (const raw of (await res.text()).split('\n')) {
      const line = raw.split('#')[0].trim(); const [k, ...rest] = line.split(':'); const v = rest.join(':').trim();
      if (/^user-agent$/i.test(k)) applies = v === '*';
      else if (applies && /^(dis)?allow$/i.test(k) && v) rules.push({ allow: /^allow$/i.test(k), path: v });
    }
    // Longest matching rule wins, as in Google's spec.
    // '*' matches any characters and a trailing '$' anchors the end, so Shopify's
    // 'Disallow: /products/*?*variant=*' blocks only variant URLs, not product pages.
    const test = '/products/sample-product';
    const toRe = (p) => new RegExp('^' + p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'));
    const hit = rules.filter((r) => toRe(r.path).test(test)).sort((a, b) => b.path.length - a.path.length)[0];
    return hit && !hit.allow ? 'BLOCKED' : 'ok';
  } catch { return 'none'; }
}

// Runs in the page: signs of bot challenges or login walls.
const wall = () => {
  const text = (document.title + ' ' + (document.body?.innerText || '').slice(0, 3000)).toLowerCase();
  if (/just a moment|attention required|verify you are human|captcha|access denied|are you a robot/.test(text)
    || document.querySelector('#challenge-form, iframe[src*="captcha"], iframe[src*="challenges.cloudflare"]')) return 'bot challenge';
  if (/\/(password|account\/login|login|signin)/.test(location.pathname)) return 'login/password wall';
  return null;
};

// Runs in the page: data sources the reader can use.
const sources = async () => {
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => /"@type"\s*:\s*\[?\s*"Product(Group)?"/.test(s.textContent || ''));
  const og = document.querySelector('meta[property="og:type"]')?.content === 'product'
    || !!document.querySelector('meta[property="product:price:amount"]');
  let js = false;
  try { const r = await fetch(`${location.pathname.replace(/\/$/, '')}.js`); js = r.ok && /"handle"/.test(await r.text()); } catch {}
  return { ld, og, js };
};

// Finds one in-stock product URL: Shopify products.json first, then product links on the homepage.
async function findProduct(page, origin) {
  const handle = await page.evaluate(async () => {
    try {
      const r = await fetch('/products.json?limit=30'); if (!r.ok) return null;
      const list = (await r.json()).products || [];
      return (list.find((p) => (p.variants || []).some((v) => v.available)) || list[0])?.handle ?? null;
    } catch { return null; }
  });
  if (handle) return `${origin}/products/${encodeURIComponent(handle)}`;
  return page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href]')].map((x) => x.href)
      .filter((h) => h.startsWith(location.origin) && /\/products?\/[^/?#]+/.test(h));
    return a.find((h) => /\/products\//.test(h)) || a[0] || null;
  });
}

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless }); }
catch { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless }); }

const rows = [];
for (const { category, host } of JOBS) {
  const row = { category, host, robots: '-', page: '-', path: '-', ld: '-', og: '-', js: '-', title: '-', price: '-', result: '' };
  const ctx = await browser.newContext({ locale: 'en-PK', timezoneId: 'Asia/Karachi' });
  const page = await ctx.newPage();
  try {
    const home = await page.goto(`https://${host}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const origin = new URL(page.url()).origin; // follows bare <-> www redirects
    if (origin !== `https://${host}`) row.host = `${host} -> ${new URL(origin).host}`;
    row.robots = await robots(origin);
    const homeWall = await page.evaluate(wall);
    if (!home || home.status() >= 400 || homeWall) throw new Error(homeWall || `homepage HTTP ${home?.status()}`);

    const url = await findProduct(page, origin);
    if (!url) throw new Error('no product link found');
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const w = await page.evaluate(wall);
    row.page = res && res.status() < 400 && !w ? 'ok' : (w || `HTTP ${res?.status()}`);
    const finalPath = new URL(page.url()).pathname;
    row.path = finalPath.startsWith('/products/') ? 'ok' : finalPath.slice(0, 24);
    Object.assign(row, await page.evaluate(sources));

    await page.addScriptTag({ content: reader }).catch(() => {});
    const product = await page.evaluate(() => window.UnhaulExtract?.readProductPage(document, location.href) ?? null).catch(() => null);
    if (product) Object.assign(row, { title: String(product.title).slice(0, 28), price: product.price === null ? 'null' : `${product.price} ${product.currency ?? ''}` });

    const why = [
      row.robots === 'BLOCKED' && 'robots.txt disallows /products/',
      row.page !== 'ok' && row.page,
      row.path !== 'ok' && 'URL is not /products/<handle>',
      !row.ld && !row.og && !row.js && 'no product data',
      !product && 'reader found no product',
    ].filter(Boolean);
    // Variants with different prices: the reader leaves price empty rather than guess. Still usable.
    const noPrice = product && (typeof product.price !== 'number' || product.currency !== 'PKR');
    row.result = why.length ? `FAIL: ${why.join('; ')}` : noPrice ? 'PASS (price empty: variants differ)' : 'PASS';
    row.url = url;
  } catch (e) {
    row.result = `ERROR: ${String(e.message).split('\n')[0].slice(0, 60)}`;
  }
  rows.push(row);
  await ctx.close();
  await new Promise((r) => setTimeout(r, 2000)); // be polite
}
await browser.close();

console.table(rows.map(({ url, ...r }) => r));
const pass = rows.filter((r) => r.result.startsWith('PASS'));
console.log(`\n${pass.length}/${rows.length} stores PASS.`);
if (pass.length) {
  console.log('\nSample product pages that passed:');
  for (const r of pass) console.log(`  ${r.url}`);
  console.log('\nTo use one: save fixtures, add the domain, then check offline:');
  console.log(`  npm run fixtures:auto -- ${pass.map((r) => `${r.category}:${r.host.split(' -> ').pop().replace(/^www\./, '')}`).join(' ')}`);
  console.log('  add each domain to STORE_DOMAINS in src/store/stores.ts (no www.)');
  console.log('  npm run fixtures:check');
}
