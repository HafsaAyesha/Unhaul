import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle = await readFile(process.env.UNHAUL_UI_BUNDLE || '/tmp/unhaul-reflection-harness.js', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fixture = {
    '@context': 'https://schema.org', '@type': 'Product', name: 'Notebook <img src=x onerror="window.injected=1">',
    url: 'https://www.daraz.pk/products/notebook-i1.html', offers: { '@type': 'Offer', price: '1500', priceCurrency: 'PKR' },
  };
  await page.route('https://www.daraz.pk/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Synthetic Unhaul fixture</title><script type="application/ld+json">${JSON.stringify(fixture)}</script><h1>Store product</h1><button id="cart" type="button">Add to cart</button>` }));
  await page.goto(fixture.url);
  await page.evaluate(() => {
    window.cartCount = 0; window.prevented = [];
    document.querySelector('#cart').addEventListener('click', event => { window.cartCount++; window.prevented.push(event.defaultPrevented); });
  });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => { window.h = UnhaulHarness.start(); });
  await page.waitForFunction(() => window.h.root?.querySelector('.badge')?.textContent.includes('2 similar'));
  assert.equal(await page.locator('[data-unhaul-root]').count(), 1);
  await page.evaluate(() => { const badge = window.h.root.querySelector('.badge'); badge.focus(); badge.click(); });
  assert.equal(await page.evaluate(() => window.h.root.querySelector('.panel').hidden), false);
  assert.equal(await page.evaluate(() => window.h.root.querySelectorAll('li img').length), 0);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.match(await page.evaluate(() => window.h.root.querySelector('h3').textContent), /<img/);
  assert.equal(await page.evaluate(() => window.h.root.querySelectorAll('.panel button')[1].disabled), true);
  assert.match(await page.evaluate(() => window.h.root.querySelector('#unhaul-save-note').textContent), /not available/);
  assert.equal(await page.evaluate(() => window.h.root.querySelector('.panel').getBoundingClientRect().right <= innerWidth), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.h.root.querySelector('.panel').hidden), true);
  assert.equal(await page.evaluate(() => window.h.root.activeElement === window.h.root.querySelector('.badge')), true);
  await page.locator('#cart').click();
  await page.waitForFunction(() => !window.h.root.querySelector('.panel').hidden);
  await page.evaluate(() => [...window.h.root.querySelectorAll('button')].find(button => button.textContent === 'Continue shopping').click());
  await page.locator('#cart').click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.h.root.querySelector('.panel').hidden), true);
  assert.equal(await page.evaluate(() => window.cartCount), 2);
  assert.deepEqual(await page.evaluate(() => window.prevented), [false, false]);
  // Rerenders do not duplicate mounts or analysis.
  await page.evaluate(() => document.body.append(document.createElement('span')));
  await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-unhaul-root]').count(), 1);
  assert.equal(await page.evaluate(() => window.h.analyses), 1);
  const changeProduct = async (title, path, offers = null) => {
    await page.evaluate(({ title, path, offers }) => {
      history.pushState({}, '', path);
      document.querySelector('script[type="application/ld+json"]').textContent = JSON.stringify({ '@type': 'Product', name: title, url: location.href, ...(offers ? { offers } : {}) });
    }, { title, path, offers });
  };
  await changeProduct('Slow notebook', '/products/slow-i2.html');
  await page.waitForFunction(() => window.h.root?.querySelector('.badge')?.textContent.includes('checking'));
  await changeProduct('Wireless headphones', '/products/audio-i3.html');
  await page.waitForFunction(() => window.h.root?.querySelector('h3')?.textContent === 'Wireless headphones');
  await page.evaluate(() => window.h.finishSlow());
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.h.root.querySelector('h3').textContent), 'Wireless headphones');
  assert.match(await page.evaluate(() => window.h.root.querySelector('.panel').textContent), /Price unavailable/);
  await changeProduct('Broken notebook', '/products/broken-i4.html');
  await page.waitForFunction(() => window.h.root?.querySelector('.badge')?.textContent.includes('unavailable'));
  assert.match(await page.evaluate(() => window.h.root.querySelector('.panel').textContent), /Analysis is unavailable/);
  await page.evaluate(() => window.h.revoke());
  assert.equal(await page.locator('[data-unhaul-root]').count(), 0);
  const claims = await page.evaluate(() => window.h.claims);
  await page.evaluate(() => { document.querySelector('#cart').click(); document.body.append(document.createElement('span')); });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-unhaul-root]').count(), 0);
  assert.equal(await page.evaluate(() => window.h.claims), claims);
  console.log('PASS: synthetic Chromium UI — safe text, manual open, Escape/focus, responsive layout, merchant clicks, opening limit, stale results, error/missing-price states, cleanup.');
} finally { await browser.close(); }
