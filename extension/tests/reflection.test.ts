import { expect, it } from 'vitest';
import { choosePrompt } from '../src/match/prompts';
it('prioritizes owned matches, verified discounts, recorded repeat visits, then the generic question', () => {
  const sale = { price: 10, wasPrice: 20, currency: 'PKR' };
  expect(choosePrompt(1, sale, true)).toBe('What would this add beyond what you already own?');
  expect(choosePrompt(0, sale, true)).toBe('Would you still want this at full price?');
  expect(choosePrompt(0, { ...sale, wasPrice: 5 }, true)).toBe('What need would this purchase meet?');
  expect(choosePrompt(0, { ...sale, price: null })).toBe('Would you still want this after three days?');
  expect(choosePrompt(0, { ...sale, currency: null })).toBe('Would you still want this after three days?');
});

it('formats known price and omits missing price or currency without a zero placeholder', async () => {
  const { build } = await import('esbuild');
  const { chromium } = await import('playwright');
  const bundle = await build({ entryPoints: ['src/ui/panel.ts'], bundle: true, write: false, format: 'iife', globalName: 'PanelTest' });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium', headless: true });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const result = await page.evaluate(() => {
      const api = (window as unknown as { PanelTest: { createPanel: typeof import('../src/ui/panel').createPanel } }).PanelTest;
      const panel = api.createPanel(() => {});
      document.body.append(panel.element); panel.element.hidden = false;
      const product: import('../src/shared/types').Product = {
        store: 'example', productId: 'journal', url: 'https://example.com/products/journal', title: 'Journal',
        price: 1800, currency: 'PKR', wasPrice: null, imageUrl: null,
      };
      panel.update(product, null, false);
      const priced = panel.element.textContent;
      panel.update({ ...product, price: null }, null, false);
      const missing = panel.element.textContent;
      const hidden = panel.element.querySelector('h3 + p')!.hasAttribute('hidden');
      panel.update({ ...product, currency: null }, null, false);
      const missingCurrency = panel.element.textContent;
      panel.dispose(); return { priced, missing, hidden, missingCurrency };
    });
    expect(result.priced).toContain('PKR 1,800');
    expect(result.hidden).toBe(true);
    for (const text of [result.missing, result.missingCurrency]) {
      expect(text).not.toContain('PKR'); expect(text).not.toContain('Price unavailable'); expect(text).not.toContain('0');
    }
  } finally { await browser.close(); }
});
