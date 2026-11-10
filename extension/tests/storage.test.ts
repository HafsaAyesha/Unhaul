import { EXAMPLE_CLASSIFICATION, EXAMPLE_SAVED } from '../src/shared/examples';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/types';
import { LEGACY_ITEMS_KEY, STORAGE_KEYS as K } from '../src/storage/keys';
import { sampleItems } from '../src/storage/sample-items';
const local = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
<<<<<<< HEAD
const alarms = vi.hoisted(() => ({ clearAll: vi.fn(), create: vi.fn(), getAll: vi.fn(async () => []), clear: vi.fn() }));
const action = vi.hoisted(() => ({ setBadgeText: vi.fn() }));
const notifications = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { storage: { local }, alarms, action, notifications } }));
=======
vi.mock('wxt/browser', () => ({ browser: { storage: { local, session: {
  get: async (key: string | null) => key === null ? { ...sessionData } : Object.hasOwn(sessionData, key) ? { [key]: sessionData[key] } : {},
  set: async (values: Record<string, unknown>) => { Object.assign(sessionData, structuredClone(values)); },
  remove: async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete sessionData[key]; },
} } } }));
>>>>>>> 2af525da18ce24d9afafd49b6aba7ae3e6b8fb65
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
    await repo.addItem({ ...manual, name: 'Overwrite' });
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

describe('saved deadlines, samples, insights', () => {
  const product = { store: 'example.org', id: 'p1', title: 'Notebook', url: 'https://example.org/products/p1', price: 80 };
  function waiting(overrides: Partial<{ savedAt: number; wait: 1 | 3 | 7 | null; id: string; price: number | null }> = {}) {
    const savedAt = overrides.savedAt ?? 1_000_000;
    const wait = overrides.wait === undefined ? 1 : overrides.wait;
    const deadline = wait == null ? null : savedAt + wait * 86_400_000;
    return {
      id: overrides.id ?? 'p1',
      product: { ...product, id: overrides.id ?? 'p1', price: overrides.price === undefined ? 80 : overrides.price ?? undefined },
      savedAt, reconsiderAt: deadline ?? savedAt, deadline, status: 'waiting' as const,
    };
  }
  it('sets deadline per wait and Ready only after a timed deadline', async () => {
    const { waitDeadline, isReady } = await import('../src/storage/insights');
    const savedAt = 1_000_000;
    expect(waitDeadline(savedAt, 1)).toBe(savedAt + 86_400_000);
    expect(waitDeadline(savedAt, 3)).toBe(savedAt + 3 * 86_400_000);
    expect(waitDeadline(savedAt, 7)).toBe(savedAt + 7 * 86_400_000);
    expect(waitDeadline(savedAt, null)).toBeNull();
    const timed = waiting({ savedAt, wait: 1 });
    expect(isReady(timed, savedAt + 86_400_000 - 1)).toBe(false);
    expect(isReady(timed, savedAt + 86_400_000)).toBe(true);
    expect(isReady(waiting({ savedAt, wait: null }), savedAt + 86_400_000 * 30)).toBe(false);
  });
  it('save twice keeps one waiting item', async () => {
    const { repo } = await import('../src/storage/repo');
    const item = waiting();
    expect(await repo.upsertSaved(item)).toEqual({ result: 'saved', deadline: item.deadline });
    expect(await repo.upsertSaved({ ...item, savedAt: item.savedAt + 10 })).toEqual({ result: 'already_saved', deadline: item.deadline });
    expect(await repo.getSavedItems()).toHaveLength(1);
  });
  it('samples twice add no duplicate IDs', async () => {
    const { repo } = await import('../src/storage/repo');
    expect(await repo.loadSampleItems()).toBe(sampleItems.length);
    expect(await repo.loadSampleItems()).toBe(0);
    expect(await repo.getItems()).toHaveLength(sampleItems.length);
    expect(sampleItems.filter(item => item.itemType === 'suit' && item.colorFamily === 'green').length).toBeGreaterThanOrEqual(3);
  });
  it('delete all leaves no unhaul: keys and clears alarms and badge', async () => {
    data = { [K.settings]: { ...DEFAULT_SETTINGS }, [K.items]: sampleItems, [K.saved]: [], 'unhaul:extra': 1, unrelated: 'keep' };
    const { repo } = await import('../src/storage/repo');
    await repo.deleteAllUnhaulData();
    expect(Object.keys(data).filter(key => key.startsWith('unhaul:'))).toEqual([]);
    expect(alarms.clearAll).toHaveBeenCalled();
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });
  it('budget share, over-budget flag, and hidden when none', async () => {
    const { computeInsights } = await import('../src/storage/insights');
    const now = Date.UTC(2026, 10, 10);
    const skipped = { ...waiting({ id: 's', price: 40 }), status: 'skipped' as const, decidedAt: now };
    const purchased = { ...waiting({ id: 'b', price: 30 }), status: 'purchased' as const, decidedAt: now };
    const noPrice = { ...waiting({ id: 'n', price: null }), status: 'purchased' as const, decidedAt: now };
    expect(computeInsights([skipped, purchased, noPrice], null, now).hidden).toBe(true);
    expect(computeInsights([skipped, purchased, noPrice], null, now).budgetShare(80)).toBeNull();
    const within = computeInsights([purchased, noPrice], 100, now);
    expect(within.spendThisMonth).toBe(30);
    expect(within.potentialAvoided).toBe(0);
    expect(within.budgetShare(35)).toBe(35 / 70);
    expect(within.overBudget).toBe(false);
    const over = computeInsights([purchased], 20, now);
    expect(over.overBudget).toBe(true);
    expect(over.budgetShare(1)).toBe(Number.POSITIVE_INFINITY);
    expect(computeInsights([skipped], 100, now).potentialAvoided).toBe(40);
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
