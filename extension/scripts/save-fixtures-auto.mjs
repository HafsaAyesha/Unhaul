// Saves non-clothing product pages as test fixtures. Run on your own machine with Chrome installed:
//   cd extension
//   node scripts/save-fixtures-auto.mjs                                   # every store below
//   node scripts/save-fixtures-auto.mjs toys_games:odeez.pk stationery:rung.com.pk
// Stores come from public Shopify directories and are candidates only. A store counts after it PASSES.
// Saving fixtures changes nothing in the extension. A store runs live only after it is added to
// host_permissions in wxt.config.ts and the content script matches in entrypoints/content.ts.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Category IDs follow src/shared/lists.ts CATEGORIES.
const SITES = {
  clothing_accessories: ['blingspot.pk'], // jewellery and gifts
  toys_games: ['odeez.pk', 'toynix.pk', 'alsimba.pk', 'babybazar.pk'],
  stationery: ['thestationerycompany.pk', 'theschoolstore.pk', 'rung.com.pk', 'clover.pk'],
};
const PER_STORE = 3;

const fromCli = process.argv.slice(2).map((a) => (a.includes(':') ? a.split(':') : ['other', a]));
const JOBS = fromCli.length
  ? fromCli.map(([category, host]) => ({ category, host }))
  : Object.entries(SITES).flatMap(([category, hosts]) => hosts.map((host) => ({ category, host })));

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const MANIFEST = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : [];

// Handles come from the store, so keep file names to safe characters only.
const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

// Remove personal data and tokens. Keeps ld+json and meta tags intact.
const redact = (s) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, 'REDACTED')
  .replace(/(authenticity_token[^>]*?value=")[^"]*/gi, '$1REDACTED')
  .replace(/(csrf-token"[^>]*?content=")[^"]*/gi, '$1REDACTED')
  .replace(/("(?:csrf|token|session)[A-Za-z_]*"\s*:\s*")[^"]*/gi, '$1REDACTED');

// Runs inside the page.
const inspect = () => {
  const nodes = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
    try { const j = JSON.parse(s.textContent); return j['@graph'] ?? (Array.isArray(j) ? j : [j]); }
    catch { return []; }
  });
  const p = nodes.find((n) => [].concat(n['@type'] ?? []).some((t) => /^Product(Group)?$/.test(t)));
  const offers = p ? (p.hasVariant || []).map((v) => v.offers).concat(p.offers || []).flat().filter(Boolean) : [];
  const prices = offers.map((o) => parseFloat(o.price ?? o.lowPrice)).filter((n) => n > 0);
  const btns = [...document.querySelectorAll('button,input[type=submit],a')]
    .filter((b) => /add to (cart|bag|basket)/i.test(b.innerText || b.value || b.getAttribute('aria-label') || ''));
  return {
    ld: !!p,
    shopify: !!window.Shopify || [...document.scripts].some((s) => (s.src || '').includes('cdn.shopify.com')),
    price: prices.length ? Math.min(...prices) : null,
    currency: offers.find((o) => o.priceCurrency)?.priceCurrency ?? null,
    addButtons: btns.length,
  };
};

// Runs inside the store's own page (same origin). Falls back to homepage links.
const listProducts = async (page) => {
  const fromJson = await page.evaluate(async () => {
    try {
      const r = await fetch('/products.json?limit=250');
      if (!r.ok) return null;
      return (await r.json()).products.map((p) => {
        const vs = p.variants || [];
        const prices = vs.map((v) => parseFloat(v.price)).filter((n) => n > 0);
        return {
          handle: p.handle, type: p.product_type || '', available: vs.some((v) => v.available),
          price: prices.length ? Math.min(...prices) : null,
          sale: vs.some((v) => parseFloat(v.compare_at_price) > parseFloat(v.price)),
        };
      });
    } catch { return null; }
  });
  if (fromJson?.length) return fromJson;
  const handles = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/products/"]')]
    .map((a) => new URL(a.href).pathname.split('/products/')[1]?.split('/')[0]).filter(Boolean))]);
  return handles.map((handle) => ({ handle, type: '', available: true, price: null, sale: false }));
};

// One product on sale, then full-price products of different types, then anything left.
const choose = (list) => {
  const ok = list.filter((p) => p.available && (p.price === null || p.price > 0) && safe(p.handle));
  const picked = [];
  const sale = ok.find((p) => p.sale);
  if (sale) picked.push(sale);
  const seen = new Set(picked.map((p) => p.type));
  for (const p of ok) {
    if (picked.length >= PER_STORE) break;
    if (!picked.includes(p) && !p.sale && !seen.has(p.type)) { picked.push(p); seen.add(p.type); }
  }
  for (const p of ok) {
    if (picked.length >= PER_STORE) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
};

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const rows = [];

for (const { category, host } of JOBS) {
  const ctx = await browser.newContext(); // fresh, no cookies, like a guest window
  const page = await ctx.newPage();
  let picks = [];
  try {
    await page.goto(`https://${host}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    picks = choose(await listProducts(page));
    if (!picks.length) throw new Error('no products found');
  } catch (e) {
    rows.push({ category, host, product: '-', sale: '-', ld: '-', price: '-', cur: '-', cart: '-', result: `ERROR: ${String(e.message).slice(0, 50)}` });
    await ctx.close();
    continue;
  }

  for (const pick of picks) {
    const row = { category, host, product: pick.handle.slice(0, 26), sale: pick.sale, ld: '-', price: '-', cur: '-', cart: '-', result: '' };
    try {
      const res = await page.goto(`https://${host}/products/${encodeURIComponent(pick.handle)}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(2000);
      const html = await page.content();
      if (!res || res.status() >= 400 || html.length < 5000) throw new Error(`BLOCKED (${res?.status()})`);

      const base = `${safe(category)}-${safe(host)}-${safe(pick.handle)}`.slice(0, 80);
      fs.writeFileSync(path.join(OUT, `${base}.html`), redact(html));
      const json = await page.evaluate(async (h) => {
        try { const r = await fetch(`/products/${encodeURIComponent(h)}.js`); return r.ok ? await r.text() : null; } catch { return null; }
      }, pick.handle);
      if (json) fs.writeFileSync(path.join(OUT, `${base}.json`), redact(json));

      const r = await page.evaluate(inspect);
      Object.assign(row, { ld: r.ld, price: r.price, cur: r.currency, cart: r.addButtons });
      row.result = r.ld && typeof r.price === 'number' && r.currency === 'PKR' && r.addButtons > 0 ? 'PASS' : 'FAIL';

      const entry = { file: `${base}.html`, json: json ? `${base}.json` : null, host, category, handle: pick.handle,
        url: `https://${host}/products/${pick.handle}`, onSale: pick.sale, price: r.price, currency: r.currency,
        result: row.result, capturedAt: new Date().toISOString().slice(0, 10) };
      const i = manifest.findIndex((m) => m.file === entry.file);
      if (i >= 0) manifest[i] = entry; else manifest.push(entry);
    } catch (e) {
      row.result = `ERROR: ${String(e.message).slice(0, 50)}`;
    }
    rows.push(row);
    await new Promise((r) => setTimeout(r, 3000)); // be polite
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.table(rows);
const passHosts = [...new Set(rows.filter((r) => r.result === 'PASS').map((r) => `${r.category}|${r.host}`))];
console.log('\nStores with at least one PASS. To run live, add each to wxt.config.ts host_permissions and content.ts matches:');
for (const h of passHosts) {
  const [cat, host] = h.split('|');
  console.log(`  'https://${host}/*'   // ${cat}`);
}
console.log(`\nFixtures: ${OUT}\nManifest: ${MANIFEST}`);
