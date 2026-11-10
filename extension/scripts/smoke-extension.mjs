import { chromium } from 'playwright';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const extensionPath = resolve(process.env.UNHAUL_BUILD_DIR || '.output/chrome-mv3');
const manifest = JSON.parse(await readFile(resolve(extensionPath, 'manifest.json'), 'utf8'));
assert.equal(manifest.name, 'Unhaul');
assert.ok(manifest.host_permissions.includes('https://www.daraz.pk/*'));
if (!process.env.UNHAUL_BUILD_DIR?.endsWith('-dev')) {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['https://www.daraz.pk/*']);
}
if (manifest.content_scripts) assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.daraz.pk/products/*']);
const profile = await mkdtemp(resolve(tmpdir(), 'unhaul-test-profile-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
  // Synthetic fixture: checks injection and messaging, not live Daraz integration.
  await context.route('https://www.daraz.pk/**', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Unhaul test fixture</title><h1>Synthetic product fixture</h1>',
  }));
  const page = await context.newPage();
  const logs = [];
  page.on('console', message => logs.push(message.text()));
  await page.goto('https://www.daraz.pk/products/unhaul-fixture-i123.html');
  await page.waitForTimeout(3500);
  assert.equal(logs.includes('[Unhaul] PONG'), false, 'No connectivity behavior before consent');
  const extensionId = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#consent').waitFor({ state: 'visible' });
  assert.equal(await options.locator('#app').isVisible(), false);
  await options.locator('#not-now').click();
  assert.equal(await options.locator('#app').isVisible(), false);
  const pong = page.waitForEvent('console', { predicate: message => message.text() === '[Unhaul] PONG', timeout: 15000 });
  await options.locator('#agree').click();
  await pong;
  await options.locator('#app').waitFor({ state: 'visible' });
  console.log('PASS: no PONG before agreement; already-open product receives PONG after agreement');
  await options.locator('#delete-data').click();
  await options.locator('#consent').waitFor({ state: 'visible' });
  const beforeReload = logs.filter(log => log === '[Unhaul] PONG').length;
  await page.reload();
  await page.waitForTimeout(3500);
  assert.equal(logs.filter(log => log === '[Unhaul] PONG').length, beforeReload);
  console.log('PASS: deleting consent hides options and suppresses connectivity after reload');
  // A non-product page and another origin must not receive the content script.
  for (const url of ['https://www.daraz.pk/catalog/', 'https://example.org/products/not-supported']) {
    const other = await context.newPage();
    await other.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<title>Non-product fixture</title>' }));
    await other.goto(url);
    const cdp = await context.newCDPSession(other);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
    await cdp.send('Runtime.enable');
    assert.equal(worlds.some(world => world.origin === `chrome-extension://${extensionId}` || world.name.includes(extensionId)), false);
    await cdp.detach();
    await other.close();
  }
  console.log('PASS: no extension execution context on non-product/unsupported pages');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
