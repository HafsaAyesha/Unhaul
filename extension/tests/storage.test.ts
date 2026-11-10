import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/types';
import { LEGACY_ITEMS_KEY, STORAGE_KEYS as K } from '../src/storage/keys';
import { sampleItems } from '../src/storage/sample-items';
const local = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { storage: { local } } }));
let data: Record<string, unknown>;
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); data = {};
  local.get.mockImplementation(async (keys: string | string[]) => Object.fromEntries(
    (Array.isArray(keys) ? keys : [keys]).filter(key => Object.hasOwn(data, key))
      .map(key => [key, structuredClone(data[key])])));
  local.set.mockImplementation(async (updates: Record<string, unknown>) => { Object.assign(data, structuredClone(updates)); });
  local.remove.mockImplementation(async (key: string) => { delete data[key]; });
});
describe('storage initialization', () => {
  it('writes only missing default settings and tolerates concurrent/repeated calls', async () => {
    const { initializeStorage } = await import('../src/storage/repo');
    await Promise.all([initializeStorage(), initializeStorage()]);
    expect(data).toEqual({ [K.settings]: DEFAULT_SETTINGS });
    data[K.settings] = { schemaVersion: 1, consentGiven: true };
    await initializeStorage();
    expect(data[K.settings]).toEqual({ schemaVersion: 1, consentGiven: true });
    expect(local.set).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])('preserves existing consent %s and extra fields', async consentGiven => {
    const existing = { schemaVersion: 1, consentGiven, extra: 'preserve' };
    data[K.settings] = existing;
    await (await import('../src/storage/repo')).initializeStorage();
    expect(data[K.settings]).toEqual(existing); expect(local.set).not.toHaveBeenCalled();
  });
  it.each([null, {}, { schemaVersion: 2, consentGiven: true }, { schemaVersion: 1, consentGiven: 'yes' }, { schemaVersion: 1, consentGranted: true }])('rejects unsupported settings without overwriting: %j', async existing => {
    data[K.settings] = existing;
    await expect((await import('../src/storage/repo')).initializeStorage()).rejects.toThrow('Invalid or unsupported');
    expect(data[K.settings]).toEqual(existing); expect(local.set).not.toHaveBeenCalled();
  });
  it('propagates read/write errors and permits retry', async () => {
    const { initializeStorage } = await import('../src/storage/repo');
    local.get.mockRejectedValueOnce(new Error('read failed'));
    await expect(initializeStorage()).rejects.toThrow('read failed');
    local.set.mockRejectedValueOnce(new Error('write failed'));
    await expect(initializeStorage()).rejects.toThrow('write failed');
    await initializeStorage(); expect(data[K.settings]).toEqual(DEFAULT_SETTINGS);
  });
});
describe('legacy item migration', () => {
  it('preserves items, removes the old key and is idempotent without granting consent', async () => {
    data[LEGACY_ITEMS_KEY] = sampleItems;
    const { initializeStorage, repo } = await import('../src/storage/repo');
    await initializeStorage(); await initializeStorage();
    expect(await repo.getItems()).toEqual(sampleItems);
    expect(data[LEGACY_ITEMS_KEY]).toBeUndefined();
    expect(data[K.settings]).toEqual(DEFAULT_SETTINGS); expect(local.remove).toHaveBeenCalledTimes(1);
  });
  it('merges disjoint IDs and deduplicates identical records', async () => {
    data[K.items] = [sampleItems[0]]; data[LEGACY_ITEMS_KEY] = [sampleItems[0], sampleItems[1]];
    await (await import('../src/storage/repo')).initializeStorage();
    expect(data[K.items]).toEqual([sampleItems[0], sampleItems[1]]);
  });
  it('retains both records when an ID conflicts', async () => {
    data[K.items] = [sampleItems[0]]; data[LEGACY_ITEMS_KEY] = [{ ...sampleItems[0], name: 'Edited' }];
    const before = structuredClone(data);
    await expect((await import('../src/storage/repo')).initializeStorage()).rejects.toThrow('Conflicting legacy');
    expect(data).toEqual(before); expect(local.remove).not.toHaveBeenCalled();
  });
  it('retains malformed legacy data without writing defaults', async () => {
    data[LEGACY_ITEMS_KEY] = [{ id: 'incomplete' }]; const before = structuredClone(data);
    await expect((await import('../src/storage/repo')).initializeStorage()).rejects.toThrow('Invalid Unhaul items');
    expect(data).toEqual(before);
  });
  it('retains the original if copying fails', async () => {
    data[LEGACY_ITEMS_KEY] = sampleItems; local.set.mockRejectedValueOnce(new Error('quota'));
    await expect((await import('../src/storage/repo')).initializeStorage()).rejects.toThrow('quota');
    expect(data[LEGACY_ITEMS_KEY]).toEqual(sampleItems); expect(local.remove).not.toHaveBeenCalled();
  });
  it('retries safely when cleanup fails after copying', async () => {
    data[LEGACY_ITEMS_KEY] = sampleItems; local.remove.mockRejectedValueOnce(new Error('cleanup'));
    const { initializeStorage } = await import('../src/storage/repo');
    await expect(initializeStorage()).rejects.toThrow('cleanup');
    expect(data[LEGACY_ITEMS_KEY]).toEqual(sampleItems); expect(data[K.items]).toEqual(sampleItems);
    await initializeStorage(); expect(data[LEGACY_ITEMS_KEY]).toBeUndefined(); expect(data[K.items]).toEqual(sampleItems);
  });
  it('reads and writes owned items only under the new key', async () => {
    const { repo } = await import('../src/storage/repo'); await repo.setItems(sampleItems);
    expect(await repo.getItems()).toEqual(sampleItems); expect(data[LEGACY_ITEMS_KEY]).toBeUndefined();
  });
});
