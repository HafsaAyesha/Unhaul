import { EXAMPLE_CLASSIFICATION, EXAMPLE_PRODUCT, EXAMPLE_SAVED } from '../src/shared/examples';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/types';
import { LEGACY_ITEMS_KEY, STORAGE_KEYS as K } from '../src/storage/keys';
import { sampleItems } from '../src/storage/sample-items';
const local = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { storage: { local, session: {
  get: async (key: string | null) => key === null ? { ...sessionData } : Object.hasOwn(sessionData, key) ? { [key]: sessionData[key] } : {},
  set: async (values: Record<string, unknown>) => { Object.assign(sessionData, structuredClone(values)); },
  remove: async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete sessionData[key]; },
} } } }));
let data: Record<string, unknown>;
let sessionData: Record<string, unknown>;
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); data = {}; sessionData = {};
  local.get.mockImplementation(async (keys: string | string[] | null) => Object.fromEntries(
    (keys === null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys]).filter(key => Object.hasOwn(data, key))
      .map(key => [key, structuredClone(data[key])])));
  local.set.mockImplementation(async (updates: Record<string, unknown>) => { Object.assign(data, structuredClone(updates)); });
  local.remove.mockImplementation(async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; });
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

  describe('cooling-off lock lookup', () => {
    it('only locks an exact waiting product variant before its deadline', async () => {
      const saved = { ...EXAMPLE_SAVED, product: { ...EXAMPLE_PRODUCT, variantId: 'blue' }, deadline: 2000, reconsiderAt: 2000, savedAt: 1000 };
      data[K.settings] = { ...DEFAULT_SETTINGS, consentGiven: true, cooldownLock: true };
      data[K.saved] = [saved];
      const { getCooldownLock } = await import('../src/storage/repo');
      expect((await getCooldownLock({ ...EXAMPLE_PRODUCT, variantId: 'red' }, 1500)).locked).toBe(false);
      expect((await getCooldownLock({ ...EXAMPLE_PRODUCT, variantId: 'blue' }, 1500)).locked).toBe(true);
      expect((await getCooldownLock({ ...EXAMPLE_PRODUCT, variantId: 'blue' }, 2000)).locked).toBe(false);
    });

    it.each([
      ['lock off', { consentGiven: true, cooldownLock: false }],
      ['consent missing', { consentGiven: false, cooldownLock: true }],
    ])('does not lock when %s', async (_label, settings) => {
      data[K.settings] = { ...DEFAULT_SETTINGS, ...settings };
      data[K.saved] = [EXAMPLE_SAVED];
      const { getCooldownLock } = await import('../src/storage/repo');
      expect((await getCooldownLock(EXAMPLE_PRODUCT, EXAMPLE_SAVED.deadline - 1)).locked).toBe(false);
    });

    it('treats a missing cooldownLock setting as on', async () => {
      data[K.settings] = { ...DEFAULT_SETTINGS, consentGiven: true };
      data[K.saved] = [EXAMPLE_SAVED];
      const { getCooldownLock } = await import('../src/storage/repo');
      expect((await getCooldownLock(EXAMPLE_PRODUCT, EXAMPLE_SAVED.deadline - 1)).locked).toBe(true);
    });

    it('does not lock skipped or purchased records', async () => {
      data[K.settings] = { ...DEFAULT_SETTINGS, consentGiven: true, cooldownLock: true };
      data[K.saved] = [{ ...EXAMPLE_SAVED, status: 'skipped' }, { ...EXAMPLE_SAVED, id: 'purchased', status: 'purchased' }];
      const { getCooldownLock } = await import('../src/storage/repo');
      expect((await getCooldownLock(EXAMPLE_PRODUCT, EXAMPLE_SAVED.savedAt + 1)).locked).toBe(false);
    });

    it('ends a waiting item early and lifts its lock', async () => {
      data[K.settings] = { ...DEFAULT_SETTINGS, consentGiven: true };
      data[K.saved] = [EXAMPLE_SAVED];
      const { endWaitEarly, getCooldownLock } = await import('../src/storage/repo');
      const ended = await endWaitEarly(EXAMPLE_SAVED.id);
      expect(ended.endedEarlyAt).toEqual(expect.any(Number));
      expect((await getCooldownLock(EXAMPLE_PRODUCT, EXAMPLE_SAVED.savedAt + 1)).locked).toBe(false);
    });
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
  it('prefers namespaced records on conflicting IDs and removes legacy after copying', async () => {
    data[K.items] = [sampleItems[0]]; data[LEGACY_ITEMS_KEY] = [{ ...sampleItems[0], name: 'Edited' }];
    await (await import('../src/storage/repo')).initializeStorage();
    expect(data[K.items]).toEqual([sampleItems[0]]);
    expect(data[LEGACY_ITEMS_KEY]).toBeUndefined();
    expect(data[K.settings]).toEqual(DEFAULT_SETTINGS);
  });
  it('retains malformed legacy data without writing defaults', async () => {
    data[LEGACY_ITEMS_KEY] = [{ id: 'incomplete' }]; const before = structuredClone(data);
    await expect((await import('../src/storage/repo')).initializeStorage()).rejects.toThrow('legacy Unhaul items');
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
    const { repo } = await import('../src/storage/repo'); for (const item of sampleItems) await repo.addItem(item);
    expect(await repo.getItems()).toEqual(sampleItems); expect(data[LEGACY_ITEMS_KEY]).toBeUndefined();
  });
});

describe('repository operations and ordering', () => {
  it('returns safe defaults without creating keys', async () => {
    const { repo } = await import('../src/storage/repo');
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await repo.getItems()).toEqual([]);
    expect(await repo.getSavedItems()).toEqual([]);
    expect(await repo.getVisits()).toEqual([]);
    expect(await repo.getClassificationCache()).toEqual({});
    expect(data).toEqual({}); expect(local.set).not.toHaveBeenCalled();
  });
  it('merges concurrent samples/adds without duplicates or lost manual records', async () => {
    const { repo } = await import('../src/storage/repo');
    const edited = { ...sampleItems[0], name: 'My edited journal' };
    await repo.addItem(edited);
    const manual = { ...sampleItems[1], id: 'manual-1' };
    const [added, again] = await Promise.all([repo.loadSampleItems(), repo.loadSampleItems(), repo.addItem(manual)]);
    expect(added).toBe(sampleItems.length - 1); expect(again).toBe(0);
    const items = await repo.getItems();
    expect(items).toHaveLength(sampleItems.length + 1);
    expect(items.find(item => item.id === edited.id)).toEqual(edited);
    expect(items).toContainEqual(manual);
    await expect(repo.addItem({ ...manual, name: 'Overwrite' })).rejects.toThrow('already exists');
    expect((await repo.getItems()).find(item => item.id === manual.id)).toEqual(manual);
  });
  it('orders queued reads after slow writes and recovers after failed writes', async () => {
    const { repo } = await import('../src/storage/repo');
    let finish: (() => void) | undefined;
    const paused = new Promise<void>(resolve => { finish = resolve; });
    let started: (() => void) | undefined;
    const entered = new Promise<void>(resolve => { started = resolve; });
    local.set.mockImplementationOnce(async (updates: Record<string, unknown>) => {
      started!(); await paused; Object.assign(data, structuredClone(updates));
    });
    const save = repo.addItem(sampleItems[0]);
    let observed = false;
    const read = repo.getItems().then(items => { observed = true; return items; });
    await entered;
    expect(observed).toBe(false);
    finish!(); await save; expect(await read).toEqual([sampleItems[0]]);
    local.set.mockRejectedValueOnce(new Error('disk failed'));
    await expect(repo.addItem(sampleItems[1])).rejects.toThrow('disk failed');
    await repo.addItem(sampleItems[2]);
    expect(await repo.getItems()).toEqual([sampleItems[0], sampleItems[2]]);
  });
  it('deletes unknown IDs without writing and deletes known IDs persistently', async () => {
    const { repo } = await import('../src/storage/repo');
    await repo.deleteItem('absent'); expect(local.set).not.toHaveBeenCalled();
    await repo.addItem(sampleItems[0]); await repo.deleteItem(sampleItems[0].id);
    expect(await repo.getItems()).toEqual([]);
  });
  it('changes consent without replacing other settings', async () => {
    data[K.settings] = { ...DEFAULT_SETTINGS, extra: 'keep' };
    const { repo } = await import('../src/storage/repo');
    await repo.setConsent(true); expect(data[K.settings]).toEqual({ schemaVersion: 1, consentGiven: true, extra: 'keep' });
    await repo.setConsent(false); expect((await repo.getSettings()).consentGiven).toBe(false);
  });
  it('round-trips snapshots and replaces instead of merging collections', async () => {
    const { repo } = await import('../src/storage/repo');
    await repo.setConsent(true);
    const saved = { ...EXAMPLE_SAVED };
    await repo.setSavedItems([saved]); expect(await repo.getSavedItems()).toEqual([saved]);
    await repo.setSavedItems([]); expect(await repo.getSavedItems()).toEqual([]);
    await repo.setVisits([{ productId: 'p1', times: [1, 2] }]); expect(await repo.getVisits()).toEqual([{ productId: 'p1', times: [1, 2] }]);
    await repo.setVisits([]); expect(await repo.getVisits()).toEqual([]);
    const cache = { p1: EXAMPLE_CLASSIFICATION };
    await repo.setClassificationCache(cache); expect(await repo.getClassificationCache()).toEqual(cache);
    await repo.setClassificationCache({}); expect(await repo.getClassificationCache()).toEqual({});
  });
  it('rejects malformed persisted collections, even when replacing them', async () => {
    const { repo } = await import('../src/storage/repo');
    data[K.saved] = null; data[K.visits] = [{ productId: 'p', times: ['yesterday'] }]; data[K.classificationCache] = [];
    await expect(repo.getSavedItems()).rejects.toThrow('saved items');
    await expect(repo.setSavedItems([])).rejects.toThrow('saved items');
    await expect(repo.getVisits()).rejects.toThrow('visits');
    await expect(repo.setVisits([])).rejects.toThrow('visits');
    await expect(repo.getClassificationCache()).rejects.toThrow('classification cache');
    await expect(repo.setClassificationCache({})).rejects.toThrow('classification cache');
    expect(local.set).not.toHaveBeenCalled();
  });
  it('deletes all prefixed and legacy keys, preserves unrelated data, and reads do not recreate settings', async () => {
    data = { [K.settings]: { ...DEFAULT_SETTINGS }, [K.items]: sampleItems, [K.saved]: [], [K.visits]: [], [K.classificationCache]: {}, 'unhaul:future-cache': { x: 1 }, items: sampleItems, unrelated: 'keep' };
    const { repo } = await import('../src/storage/repo');
    await repo.deleteAllUnhaulData();
    expect(data).toEqual({ unrelated: 'keep' });
    await repo.getSettings(); await repo.getItems(); await repo.getSavedItems(); await repo.getVisits(); await repo.getClassificationCache();
    expect(data).toEqual({ unrelated: 'keep' });
  });
  it('serializes initialization before deletion without recreating data on subsequent reads', async () => {
    const { repo } = await import('../src/storage/repo');
    await Promise.all([repo.initializeStorage(), repo.loadSampleItems(), repo.deleteAllUnhaulData()]);
    expect(await repo.getItems()).toEqual([]); expect(data).toEqual({});
  });
});

it('rejects collection access under an unsupported schema but still permits explicit deletion', async () => {
  data[K.settings] = { schemaVersion: 2, consentGiven: true };
  const { repo } = await import('../src/storage/repo');
  await expect(repo.getItems()).rejects.toThrow('Unhaul settings');
  await expect(repo.addItem(sampleItems[0])).rejects.toThrow('Unhaul settings');
  await repo.deleteAllUnhaulData(); expect(data).toEqual({});
});

it('denies product snapshots without consent while leaving owned-item management available', async () => {
  const { repo, beginConsentWork } = await import('../src/storage/repo');
  await expect(beginConsentWork()).rejects.toThrow('Consent');
  await expect(repo.setSavedItems([])).rejects.toThrow('Consent');
  await expect(repo.setVisits([])).rejects.toThrow('Consent');
  await expect(repo.setClassificationCache({})).rejects.toThrow('Consent');
  expect(data).toEqual({});
  await repo.addItem(sampleItems[0]); expect(await repo.getItems()).toEqual([sampleItems[0]]);
});
it('invalidates asynchronous work on revocation even after re-agreement', async () => {
  const { repo, beginConsentWork, verifyConsentWork } = await import('../src/storage/repo');
  await repo.setConsent(true); const work = await beginConsentWork();
  await verifyConsentWork(work);
  await repo.setConsent(false); expect(work.signal.aborted).toBe(true);
  await repo.setConsent(true);
  await expect(verifyConsentWork(work)).rejects.toThrow('revoked');
  await expect(repo.setVisits([{ productId: 'p', times: [1] }], work)).rejects.toThrow('revoked');
  expect(data[K.visits]).toBeUndefined(); work.release();
});
it('does not let late results recreate data after deletion, including after re-agreement', async () => {
  const { repo, beginConsentWork } = await import('../src/storage/repo');
  await repo.setConsent(true); const work = await beginConsentWork();
  await repo.deleteAllUnhaulData(); expect(work.signal.aborted).toBe(true);
  await expect(repo.setClassificationCache({ p: EXAMPLE_CLASSIFICATION }, work)).rejects.toThrow('Consent');
  expect(data).toEqual({});
  await repo.setConsent(true);
  await expect(repo.setClassificationCache({ p: EXAMPLE_CLASSIFICATION }, work)).rejects.toThrow('revoked');
  expect(data[K.classificationCache]).toBeUndefined();
  const fresh = await beginConsentWork();
  await repo.setClassificationCache({ p: EXAMPLE_CLASSIFICATION }, fresh);
  expect(data[K.classificationCache]).toEqual({ p: EXAMPLE_CLASSIFICATION }); fresh.release();
});
it('rejects queued sensitive writes when deletion invalidates their generation', async () => {
  const { repo } = await import('../src/storage/repo');
  await repo.setConsent(true);
  const write = repo.setVisits([{ productId: 'p', times: [1] }]);
  const deletion = repo.deleteAllUnhaulData();
  const [result] = await Promise.allSettled([write, deletion]);
  expect(result.status).toBe('rejected'); expect(data).toEqual({});
});

it('claims automatic panel opening once per product/tab and clears markers on deletion or tab close', async () => {
  const { repo, claimPanelOpen, clearPanelSession } = await import('../src/storage/repo');
  await expect(claimPanelOpen(1, 'p1')).rejects.toThrow('Consent');
  await repo.setConsent(true);
  expect(await Promise.all([claimPanelOpen(1, 'p1'), claimPanelOpen(1, 'p1')])).toEqual([true, false]);
  expect(await claimPanelOpen(2, 'p1')).toBe(true);
  expect(await claimPanelOpen(1, 'p2')).toBe(true);
  await clearPanelSession(1);
  expect(await claimPanelOpen(1, 'p1')).toBe(true);
  await repo.deleteAllUnhaulData(); expect(sessionData).toEqual({});
});

it('saves exact durations, reloads persisted deadlines, and derives Ready at the boundary', async () => {
  const { WAITS } = await import('../src/shared/lists');
  const { coolingState } = await import('../src/shared/cooling');
  const { repo, saveProduct } = await import('../src/storage/repo');
  await repo.setConsent(true);
  for (const wait of ['24h', '3d', '7d'] as const) {
    const result = await saveProduct({ ...EXAMPLE_SAVED.product, variantId: wait, price: null, imageUrl: null }, wait);
    expect(result.record.reconsiderAt).toBe(result.record.savedAt + WAITS[wait]);
    expect(coolingState(result.record, result.deadline - 1)).toEqual({ remainingMs: 1, ready: false });
    expect(coolingState(result.record, result.deadline)).toEqual({ remainingMs: 0, ready: true });
    expect(coolingState(result.record, result.deadline + 1).ready).toBe(true);
  }
  const before = await repo.getSavedItems();
  vi.resetModules();
  expect(await (await import('../src/storage/repo')).getSavedItems()).toEqual(before);
  expect(before.every(item => item.product.price === null && item.product.imageUrl === null)).toBe(true);
});
it('serializes variant-aware duplicate saves and preserves immutable decisions on resave', async () => {
  const { repo, saveProduct, decideSavedItem } = await import('../src/storage/repo');
  await repo.setConsent(true);
  const product = EXAMPLE_SAVED.product;
  const [first, duplicate] = await Promise.all([
    saveProduct(product, '24h'), saveProduct({ ...product, title: 'Changed title' }, '7d'),
    saveProduct({ ...product, variantId: 'other' }, '3d'),
    saveProduct({ ...product, productId: 'different-product' }, '3d'),
  ]);
  expect(duplicate.result).toBe('already_saved'); expect(duplicate.record).toEqual(first.record);
  expect(await repo.getSavedItems()).toHaveLength(3);
  const decided = await decideSavedItem(first.record.id, 'purchased');
  expect(decided.status).toBe('purchased'); expect(decided.decidedAt).toEqual(expect.any(Number));
  await expect(decideSavedItem(first.record.id, 'skipped')).rejects.toThrow('already recorded');
  const again = await saveProduct(product, '3d');
  expect(again.result).toBe('saved'); expect(again.record.id).not.toBe(first.record.id);
  expect((await repo.getSavedItems()).find(item => item.id === first.record.id)).toEqual(decided);
});
it('recognizes legacy active records and rejects saves/decisions after revocation or deletion', async () => {
  const { repo, saveProduct, decideSavedItem } = await import('../src/storage/repo');
  await expect(saveProduct(EXAMPLE_SAVED.product, '3d')).rejects.toThrow('Consent');
  await repo.setConsent(true); data[K.saved] = [EXAMPLE_SAVED];
  expect((await saveProduct(EXAMPLE_SAVED.product, '7d')).record).toEqual(EXAMPLE_SAVED);
  const pending = saveProduct({ ...EXAMPLE_SAVED.product, variantId: 'pending' }, '3d');
  const deletion = repo.deleteAllUnhaulData();
  await expect(pending).rejects.toThrow('Consent'); await deletion;
  expect(data).toEqual({});
  await expect(decideSavedItem(EXAMPLE_SAVED.id, 'skipped')).rejects.toThrow('Consent');
  expect(data).toEqual({});
});
describe('visit recording (FR-05)', () => {
  it('counts the same product once within 30 minutes and drops visits older than 30 days', async () => {
    data[K.settings] = { schemaVersion: 1, consentGiven: true };
    const now = Date.UTC(2026, 10, 10);
    data[K.visits] = [{ productId: 'old', times: [now - 31 * 86_400_000] }];
    const { recordVisit } = await import('../src/storage/repo');
    await recordVisit('p1', now);
    await recordVisit('p1', now + 10 * 60_000);
    await recordVisit('p1', now + 31 * 60_000);
    expect(data[K.visits]).toEqual([{ productId: 'p1', times: [now, now + 31 * 60_000] }]);
  });
  it('does not record without consent', async () => {
    data[K.settings] = { schemaVersion: 1, consentGiven: false };
    await expect((await import('../src/storage/repo')).recordVisit('p1')).rejects.toThrow();
    expect(data[K.visits]).toBeUndefined();
  });
});
