import { EXAMPLE_CLASSIFICATION, EXAMPLE_SAVED } from '../src/shared/examples';
import { beforeEach, expect, it, vi } from 'vitest';
interface TestSender { id?: string; url?: string; }
import { STORAGE_KEYS as K } from '../src/storage/keys';
import { sampleItems } from '../src/storage/sample-items';
import { isStorageRequest } from '../src/shared/storage-messages';
type Handler = (request: unknown, sender: TestSender, respond: (reply: unknown) => void) => unknown;
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn(), send: vi.fn(), listen: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: {
  storage: { local: { get: mocks.get, set: mocks.set, remove: mocks.remove } },
  runtime: { id: 'unhaul', getURL: (path: string) => `chrome-extension://unhaul/${path.replace(/^\//, '')}`,
    sendMessage: mocks.send, onMessage: { addListener: mocks.listen },
    onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() } },
} }));
vi.stubGlobal('defineBackground', (main: () => void) => main);
let data: Record<string, unknown>;
let sender: TestSender;
beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks(); data = {};
  sender = { id: 'unhaul', url: 'chrome-extension://unhaul/options.html' };
  mocks.get.mockImplementation(async (keys: string | string[] | null) => Object.fromEntries(
    (keys === null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys])
      .filter(key => Object.hasOwn(data, key)).map(key => [key, structuredClone(data[key])])));
  mocks.set.mockImplementation(async (updates: Record<string, unknown>) => { Object.assign(data, structuredClone(updates)); });
  mocks.remove.mockImplementation(async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; });
  const background = (await import('../entrypoints/background')).default as unknown as () => void;
  background();
  mocks.send.mockImplementation((message: unknown) => new Promise((resolve, reject) => {
    const handler: Handler = mocks.listen.mock.calls[0][0];
    let responded = false;
    const pending = handler(structuredClone(message), sender, reply => { responded = true; resolve(structuredClone(reply)); });
    if (pending !== true && !responded) reject(new Error('Message was not handled'));
  }));
});
it('connects the typed client to background storage, including concurrent mutations and deletion', async () => {
  const { storageClient: client } = await import('../src/storage/client');
  await client.initializeStorage(); await client.setConsent(true);
  expect((await client.getSettings()).consentGiven).toBe(true);
  const counts = await Promise.all([client.loadSampleItems(), client.loadSampleItems()]);
  expect(counts).toEqual([sampleItems.length, 0]); expect(await client.getItems()).toEqual(sampleItems);
  await client.deleteItem(sampleItems[0].id); expect(await client.getItems()).toHaveLength(sampleItems.length - 1);
  await client.addItem(sampleItems[0]); await expect(client.addItem(sampleItems[0])).rejects.toThrow('already exists');
  await client.setSavedItems([]); await client.setVisits([]); await client.setClassificationCache({});
  expect(await client.getSavedItems()).toEqual([]); expect(await client.getVisits()).toEqual([]); expect(await client.getClassificationCache()).toEqual({});
  data.unrelated = 'keep'; await client.deleteAllUnhaulData();
  expect(await client.getItems()).toEqual([]); expect((await client.getSettings()).consentGiven).toBe(false);
  expect(data).toEqual({ unrelated: 'keep' });
});
it('returns structured validation errors before any write', async () => {
  const response = await mocks.send({ type: 'STORAGE', operation: 'setConsent', args: ['true'] });
  expect(response).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  expect(data).toEqual({});
});
it('denies content access to private records and mutations while allowing settings and PING', async () => {
  sender.url = 'https://www.daraz.pk/products/example';
  const { storageClient: client } = await import('../src/storage/client');
  expect((await client.getSettings()).consentGiven).toBe(false);
  await expect(client.getItems()).rejects.toThrow('options page');
  await expect(client.setConsent(true)).rejects.toThrow('options page');
  expect(await mocks.send({ type: 'PING' })).toEqual({ type: 'PONG' });
  expect(data).toEqual({});
});
it('reports persistence failures to the client and processes the next operation', async () => {
  const { storageClient: client } = await import('../src/storage/client');
  mocks.set.mockRejectedValueOnce(new Error('quota exceeded'));
  await expect(client.loadSampleItems()).rejects.toThrow('quota exceeded');
  expect(await client.loadSampleItems()).toBe(sampleItems.length);
});
it('rejects malformed background replies', async () => {
  mocks.send.mockResolvedValueOnce({ ok: true, value: 'invalid' });
  const { storageClient: client } = await import('../src/storage/client');
  await expect(client.getSettings()).rejects.toThrow('Invalid response');
});
it('validates collection payloads, identities, timestamps, and product URLs', () => {
  const request = (operation: string, value: unknown) => ({ type: 'STORAGE', operation, args: [value] });
  expect(isStorageRequest(request('addItem', { ...sampleItems[0], category: 'invented' }))).toBe(false);
  expect(isStorageRequest(request('setVisits', [{ productId: 'p1', times: [-1] }]))).toBe(false);
  expect(isStorageRequest(request('setVisits', [{ productId: 'p1', times: [1] }, { productId: 'p1', times: [2] }]))).toBe(false);
  expect(isStorageRequest(request('setSavedItems', [EXAMPLE_SAVED]))).toBe(true);
  const badUrl = { ...EXAMPLE_SAVED, product: { ...EXAMPLE_SAVED.product, url: 'javascript:alert(1)' } };
  expect(isStorageRequest(request('setSavedItems', [badUrl]))).toBe(false);
  expect(isStorageRequest(request('setClassificationCache', { p: EXAMPLE_CLASSIFICATION }))).toBe(true);
  expect(isStorageRequest(request('setClassificationCache', { p: { ...EXAMPLE_CLASSIFICATION, source: 'invented' } }))).toBe(false);
  expect(isStorageRequest({ type: 'STORAGE', operation: 'clear', args: [] })).toBe(false);
});
