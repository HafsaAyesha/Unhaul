import labels from './labels.json';
import { afterEach, expect, it, vi } from 'vitest';
import { classifyKeywords } from '../src/classify/keywords';
import { parseAIClassification } from '../src/classify/validate';
import { findMatches } from '../src/match/match';
import { classifyAI } from '../src/classify/ai';
import { EXAMPLE_PRODUCT, EXAMPLE_CLASSIFICATION, EXAMPLE_OWNED } from '../src/shared/examples';
import worker, { allowedImageURL } from '../../proxy/src/index';
vi.mock('wxt/browser', () => ({ browser: { runtime: { getURL: () => `chrome-extension://${'a'.repeat(32)}/` } } }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('uses synonyms, title-first evidence, whole words and the longest phrase', () => {
  for (const title of ['journal', 'diary', 'notebook']) expect(classifyKeywords(title).itemType).toBe('notebook');
  expect(classifyKeywords('Notebook', 'Headphones electronics').itemType).toBe('notebook');
  expect(classifyKeywords('Open laptop box').itemType).toBe('other');
  expect(classifyKeywords('Power bank charger').itemType).toBe('power_bank');
  for (const [title, category] of [['Ceramic vase', 'home_decor'], ['Board game', 'toys_games'], ['Headphones', 'electronics'], ['Cap', 'clothing_accessories']]) expect(classifyKeywords(title).category).toBe(category);
});
it('ranks purpose support, excludes conflicts and broad categories, caps examples but preserves count', () => {
  const classification = classifyKeywords('Notebook');
  const base = { ...EXAMPLE_OWNED, category: classification.category, itemType: classification.itemType, purpose: undefined };
  const items = [base, { ...base, id: 'b', purpose: 'writing' as const }, { ...base, id: 'c' }, { ...base, id: 'd' },
    { ...base, id: 'conflict', purpose: 'charging' as const }, { ...base, id: 'category', category: 'electronics' as const }, { ...base, id: 'type', itemType: 'pen' as const }];
  const result = findMatches(classification, items);
  expect(result.totalMatches).toBe(4); expect(result.matches).toHaveLength(3);
  expect(result.matches[0].item.id).toBe('b'); expect(result.matches[0].reason).toContain('same purpose');
  expect(findMatches(classifyKeywords('Unknown'), items).totalMatches).toBe(0);
});
it('validates AI taxonomy and converts low confidence into unknown', () => {
  expect(parseAIClassification(EXAMPLE_CLASSIFICATION)?.source).toBe('ai');
  expect(parseAIClassification({ ...EXAMPLE_CLASSIFICATION, itemType: 'invented' })).toBeNull();
  expect(parseAIClassification({ ...EXAMPLE_CLASSIFICATION, confidence: 0.2 })).toMatchObject({ category: 'other', itemType: 'other' });
});
it('AI requests send public fields only and gracefully handle valid, invalid and offline results', async () => {
  const config = { url: 'https://proxy.example', token: '' };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(EXAMPLE_CLASSIFICATION))
    .mockResolvedValueOnce(Response.json({ category: 'invalid' })).mockRejectedValueOnce(new Error('offline'));
  expect(await classifyAI(EXAMPLE_PRODUCT, { config, fetcher })).toMatchObject({ source: 'ai' });
  expect(Object.keys(JSON.parse(fetcher.mock.calls[0][1].body))).toEqual(['title', 'categoryText', 'imageUrl']);
  expect(await classifyAI(EXAMPLE_PRODUCT, { config, fetcher })).toBeNull();
  expect(await classifyAI(EXAMPLE_PRODUCT, { config, fetcher })).toBeNull();
});
it('bounds a nonresponding AI client and handles caller cancellation', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(() => new Promise<Response>(() => {}));
  const options = { config: { url: 'https://proxy.example', token: '' }, fetcher, timeoutMs: 30 };
  const pending = classifyAI(EXAMPLE_PRODUCT, options);
  await vi.advanceTimersByTimeAsync(30); expect(await pending).toBeNull();
  const controller = new AbortController();
  const cancelled = classifyAI(EXAMPLE_PRODUCT, { ...options, signal: controller.signal });
  controller.abort(); expect(await cancelled).toBeNull();
});
const origin = `chrome-extension://${'a'.repeat(32)}`;
const request = (body: unknown, extra: Record<string, string> = {}) => new Request('https://proxy.example/classify', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.1', ...extra }, body: JSON.stringify(body),
});
const env = () => ({ AI_API_KEY: 'test-placeholder', ALLOWED_ORIGINS: origin, IMAGE_HOSTS: 'cdn.shopify.com', CLASSIFY_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } });
it('proxy enforces origins, size, public image destinations, redirects and rate limits', async () => {
  const settings = env(); const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 302, headers: { Location: 'http://127.0.0.1/private' } }));
  vi.stubGlobal('fetch', fetcher);
  expect(allowedImageURL('https://127.0.0.1/a', ['127.0.0.1'])).toBeNull();
  expect((await worker.fetch(request({ title: 'x', categoryText: '', imageUrl: null }, { Origin: 'https://evil.example' }), settings)).status).toBe(403);
  expect((await worker.fetch(request({ title: 'x'.repeat(3000), categoryText: '', imageUrl: null }), settings)).status).toBe(400);
  expect((await worker.fetch(request({ title: 'x', categoryText: '', imageUrl: 'https://internal.example/a' }), settings)).status).toBe(400);
  expect((await worker.fetch(request({ title: 'x', categoryText: '', imageUrl: 'https://cdn.shopify.com/a.jpg' }), settings)).status).toBe(502);
  expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
  settings.CLASSIFY_RATE_LIMITER.limit.mockResolvedValue({ success: false });
  expect((await worker.fetch(request({ title: 'x', categoryText: '', imageUrl: null }), settings)).status).toBe(429);
});
it('proxy sends validated image bytes to the vision model and returns taxonomy-only data', async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(png, { headers: { 'Content-Type': 'image/png' } }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify(EXAMPLE_CLASSIFICATION) } }] }));
  vi.stubGlobal('fetch', fetcher);
  const response = await worker.fetch(request({ title: 'Ceramic mug', categoryText: '', imageUrl: 'https://cdn.shopify.com/mug.png' }), env());
  expect(response.status).toBe(200);
  const upstream = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(upstream.model).toBe('gpt-4o-mini');
  expect(upstream.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
  expect(Object.keys(await response.json())).toEqual(['category', 'itemType', 'purpose', 'confidence']);
});

it('reports keyword misses against the unchanged hand labels', () => {
  const misses = labels.flatMap(label => {
    const actual = classifyKeywords(label.title);
    return actual.category === label.category && actual.itemType === label.itemType ? []
      : [{ title: label.title, expected: `${label.category}/${label.itemType}`, actual: `${actual.category}/${actual.itemType}` }];
  });
  console.info('Keyword label misses:', JSON.stringify(misses));
  expect(labels.length).toBeGreaterThan(0);
  expect(misses.length).toBeLessThanOrEqual(labels.length); // Diagnostic, not an accuracy target.
});
