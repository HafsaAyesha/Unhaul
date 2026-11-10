import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Add or remove URLs here. Only URLs with /products/ in the path are used.
const URLS = [
  'https://bonanzasatrangi.com/products/c-bean-turtle-neck-zipper-full-sleeves-sweater-753-13',
  'https://junaidjamshed.com/products/matt-black-plain-peshawari-sandals-jpc21363gkpln',
  'https://crossstitch.pk/products/espresso-dream-rts',
  'https://zellbury.com/products/mock-neck-zipper-sweater-1005',
  'https://outfitters.com.pk/products/f0283-113',
].filter((u) => /\/products\/[^/?#]+/.test(new URL(u).pathname));

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

// Remove personal data / tokens. Keeps ld+json and meta tags intact.
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
    title: p?.name ?? document.querySelector('meta[property="og:title"]')?.content ?? null,
    ld: !!p,
    shopify: !!window.Shopify || [...document.scripts].some((s) => (s.src || '').includes('cdn.shopify.com')),
    price: prices.length ? Math.min(...prices) : null,
    currency: offers.find((o) => o.priceCurrency)?.priceCurrency ?? null,
    addButtons: btns.length,
  };
};

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const rows = [];

for (const url of URLS) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  const handle = u.pathname.split('/products/')[1].split('/')[0];
  const base = `${host.replace(/\./g, '-')}-${handle}`.slice(0, 70);
  const ctx = await browser.newContext();            // fresh, no cookies, like a guest window
  const page = await ctx.newPage();
  const row = { host, handle: handle.slice(0, 28), ld: '-', shopify: '-', price: '-', cur: '-', cart: '-', result: '' };
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(2000);
    const html = await page.content();
    if (!res || res.status() >= 400 || html.length < 5000) throw new Error(`BLOCKED (status ${res?.status()})`);

    fs.writeFileSync(path.join(OUT, `${base}.html`), redact(html));
    const json = await page.evaluate(async (p) => {
      try { const r = await fetch(p + '.js'); return r.ok ? await r.text() : null; } catch { return null; }
    }, u.pathname);
    if (json) fs.writeFileSync(path.join(OUT, `${base}.json`), redact(json));

    const r = await page.evaluate(inspect);
    Object.assign(row, { ld: r.ld, shopify: r.shopify, price: r.price, cur: r.currency, cart: r.addButtons });
    row.result = r.ld && typeof r.price === 'number' && r.currency === 'PKR' && r.addButtons > 0
      ? 'PASS' : 'FAIL (check manually)';
  } catch (e) {
    row.result = `ERROR: ${String(e.message).slice(0, 60)}`;
  }
  rows.push(row);
  await ctx.close();
  await new Promise((r) => setTimeout(r, 3000));      // be polite
}
await browser.close();

console.table(rows);
console.log('\nAdd these to STORES only if you checked the product is clothing:');
for (const r of rows.filter((x) => x.result === 'PASS'))
  console.log(`  ${r.host.split('.')[0]}: { name: '${r.host}', hosts: ['${r.host}'] },`);
console.log(`\nFiles saved in: ${OUT}`);