/** Background-only storage implementation. UI/content must use client.ts. */
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type Settings, type OwnedItem, type SavedItem, type VisitRecord, type ClassificationCache } from '../shared/types';
import { isSettings, isItems, isOwnedItem, isSavedItems, isVisits, isCache, isNonemptyString, requireValid } from '../shared/storage-validation';
import { LEGACY_ITEMS_KEY, STORAGE_KEYS as K } from './keys';
import { sampleItems } from './sample-items';
import { WAITS, type WaitKey } from '../shared/lists';
import { coolingState, remainingLabel, savedProductIdentity } from '../shared/cooling';
import { isProduct } from '../shared/storage-validation';
import type { Product, SaveResult } from '../shared/types';
import { createConsentWork, currentConsentGeneration, invalidateConsentWork, isCurrentConsentWork, type ConsentWork } from '../consent/work';

// Reads join the same queue so acknowledged writes/deletion are observed in order.
// Only the background imports this module, giving all extension contexts one owner.
let pending: Promise<unknown> = Promise.resolve();
function queued<T>(operation: () => Promise<T>, validateSchema = true): Promise<T> {
  const result = pending.then(async () => {
    if (validateSchema) {
      const settings = await browser.storage.local.get(K.settings);
      if (Object.hasOwn(settings, K.settings)) requireValid(settings[K.settings], isSettings, 'Unhaul settings');
    }
    return operation();
  });
  pending = result.catch(() => undefined);
  return result;
}
async function read<T>(key: string, fallback: T, guard: (value: unknown) => value is T, label: string): Promise<T> {
  const data = await browser.storage.local.get(key);
  return Object.hasOwn(data, key) ? requireValid(data[key], guard, label) : fallback;
}
async function write<T>(key: string, value: T): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}
export function initializeStorage(): Promise<void> {
  return queued(async () => {
    const data = await browser.storage.local.get([K.settings, K.items, LEGACY_ITEMS_KEY]);
    const updates: Record<string, unknown> = {};
    if (Object.hasOwn(data, K.settings)) requireValid(data[K.settings], isSettings, 'Unhaul settings');
    else updates[K.settings] = { ...DEFAULT_SETTINGS };
    const current = Object.hasOwn(data, K.items) ? requireValid(data[K.items], isItems, 'Unhaul items') : [];
    const hasLegacy = Object.hasOwn(data, LEGACY_ITEMS_KEY);
    if (hasLegacy) {
      const legacy = requireValid(data[LEGACY_ITEMS_KEY], isItems, 'legacy Unhaul items');
      const merged = new Map(current.map(item => [item.id, item]));
      for (const item of legacy) if (!merged.has(item.id)) merged.set(item.id, item);
      updates[K.items] = [...merged.values()];
    }
    if (Object.keys(updates).length) await browser.storage.local.set(updates);
    if (hasLegacy) await browser.storage.local.remove(LEGACY_ITEMS_KEY);
  }, false);
}
export function getSettings(): Promise<Settings> {
  return queued(() => read(K.settings, { ...DEFAULT_SETTINGS }, isSettings, 'Unhaul settings'));
}
function assertCurrentWork(generation: number, work?: ConsentWork): void {
  if (generation !== currentConsentGeneration() || (work && !isCurrentConsentWork(work))) {
    throw new Error('Consent is required or this operation was revoked.');
  }
}
/** Guard runs inside the storage queue immediately before sensitive work/commit. */
async function requireConsent(generation: number, work?: ConsentWork): Promise<void> {
  const settings = await read(K.settings, { ...DEFAULT_SETTINGS }, isSettings, 'Unhaul settings');
  if (settings.consentGiven !== true) {
    throw new Error('Consent is required or this operation was revoked.');
  }
  assertCurrentWork(generation, work);
}
export function beginConsentWork(): Promise<ConsentWork> {
  const generation = currentConsentGeneration();
  return queued(async () => {
    await requireConsent(generation);
    assertCurrentWork(generation);
    return createConsentWork();
  });
}
export function verifyConsentWork(work: ConsentWork): Promise<void> {
  return queued(() => requireConsent(work.generation, work));
}

export function setConsent(consentGiven: boolean): Promise<void> {
  if (consentGiven === false) invalidateConsentWork();
  return queued(async () => {
    if (typeof consentGiven !== 'boolean') throw new Error('Consent must be a boolean.');
    const settings = await read(K.settings, { ...DEFAULT_SETTINGS }, isSettings, 'Unhaul settings');
    await write(K.settings, { ...settings, consentGiven });
  });
}
export function setCooldownLock(value: boolean): Promise<void> {
  return queued(async () => {
    if (typeof value !== 'boolean') throw new Error('Cooling-off lock must be a boolean.');
    const settings = await read(K.settings, { ...DEFAULT_SETTINGS }, isSettings, 'Unhaul settings');
    await write(K.settings, { ...settings, cooldownLock: value });
  });
}
export function getCooldownLock(product: Product, now = Date.now()): Promise<{ locked: boolean; reconsiderAt?: number; remainingLabel?: string }> {
  return queued(async () => {
    if (!isProduct(product)) throw new Error('Invalid product.');
    const settings = await read(K.settings, { ...DEFAULT_SETTINGS }, isSettings, 'Unhaul settings');
    if (settings.consentGiven !== true || settings.cooldownLock !== true) return { locked: false };
    const records = await read(K.saved, [], isSavedItems, 'saved items');
    const identity = savedProductIdentity(product);
    const match = records.find(item => item.status === 'waiting' && savedProductIdentity(item.product) === identity);
    if (!match) return { locked: false };
    try {
      const state = coolingState(match, now);
      return state.ready ? { locked: false } : {
        locked: true,
        reconsiderAt: match.reconsiderAt ?? match.deadline,
        remainingLabel: remainingLabel(match, now),
      };
    } catch {
      return { locked: false };
    }
  });
}
export function getItems(): Promise<OwnedItem[]> {
  return queued(() => read(K.items, [], isItems, 'Unhaul items'));
}
export function addItem(item: OwnedItem): Promise<void> {
  return queued(async () => {
    requireValid(item, isOwnedItem, 'owned item');
    const items = await read(K.items, [], isItems, 'Unhaul items');
    if (items.some(existing => existing.id === item.id)) throw new Error('An item with this ID already exists.');
    await write(K.items, [...items, item]);
  });
}
/** Unknown IDs are an idempotent no-op, with no write. */
export function deleteItem(id: string): Promise<void> {
  return queued(async () => {
    requireValid(id, isNonemptyString, 'item ID');
    const items = await read(K.items, [], isItems, 'Unhaul items');
    const remaining = items.filter(item => item.id !== id);
    if (remaining.length !== items.length) await write(K.items, remaining);
  });
}
export function loadSampleItems(): Promise<number> {
  return queued(async () => {
    const samples = requireValid(sampleItems, isItems, 'sample items');
    const items = await read(K.items, [], isItems, 'Unhaul items');
    const merged = new Map(items.map(item => [item.id, item]));
    for (const sample of samples) if (!merged.has(sample.id)) merged.set(sample.id, sample);
    const added = merged.size - items.length;
    if (added) await write(K.items, [...merged.values()]);
    return added;
  });
}
export function getSavedItems(): Promise<SavedItem[]> {
  return queued(() => read(K.saved, [], isSavedItems, 'saved items'));
}
/** Atomic save. Waiting/Ready duplicates retain their original snapshot and deadline. */
/** devTestWait gives a 1-minute deadline, honoured only in dev builds (import.meta.env.DEV is false in production). */
export const DEV_TEST_WAIT_MS = 60_000;
export async function saveProduct(product: Product, wait: WaitKey, devTestWait = false): Promise<SaveResult> {
  const generation = currentConsentGeneration();
  const snapshot = structuredClone(product);
  return queued(async () => {
    requireValid(snapshot, isProduct, 'product snapshot');
    if (!Object.hasOwn(WAITS, wait)) throw new Error('Invalid cooling-off duration.');
    await requireConsent(generation);
    const records = await read(K.saved, [], isSavedItems, 'saved items');
    const identity = savedProductIdentity(snapshot);
    const existing = records.find(item => item.status === 'waiting' && savedProductIdentity(item.product) === identity);
    if (existing) {
      assertCurrentWork(generation);
      return { type: 'SAVE_RESULT', result: 'already_saved', deadline: existing.reconsiderAt ?? existing.deadline, record: existing };
    }
    const savedAt = Date.now();
    const deadline = savedAt + (devTestWait && import.meta.env.DEV ? DEV_TEST_WAIT_MS : WAITS[wait]);
    const item: SavedItem = { id: crypto.randomUUID(), product: snapshot, wait, savedAt, deadline, reconsiderAt: deadline, status: 'waiting' };
    requireValid([item], isSavedItems, 'saved item');
    await requireConsent(generation); assertCurrentWork(generation);
    await write(K.saved, [...records, item]);
    return { type: 'SAVE_RESULT', result: 'saved', deadline, record: item };
  });
}
/** Decisions are immutable; resaving appends a new record, preserving history. */
export function decideSavedItem(id: string, status: 'skipped' | 'purchased'): Promise<SavedItem> {
  const generation = currentConsentGeneration();
  return queued(async () => {
    if (!id || !['skipped', 'purchased'].includes(status)) throw new Error('Invalid saved-item decision.');
    await requireConsent(generation);
    const records = await read(K.saved, [], isSavedItems, 'saved items');
    const index = records.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Saved item no longer exists. Refresh the list.');
    const existing = records[index];
    if (existing.status !== 'waiting') {
      if (existing.status === status) return existing;
      throw new Error('This decision is already recorded. Save the product again to reconsider it.');
    }
    const updated: SavedItem = { ...existing, status, decidedAt: Date.now() };
    requireValid([updated], isSavedItems, 'saved item');
    await requireConsent(generation); assertCurrentWork(generation);
    await write(K.saved, records.map((item, position) => position === index ? updated : item));
    return updated;
  });
}
/** Full-snapshot replacement, not an incremental merge. */
export function setSavedItems(records: SavedItem[], work?: ConsentWork): Promise<void> {
  const generation = work?.generation ?? currentConsentGeneration();
  return queued(async () => {
    requireValid(records, isSavedItems, 'saved items');
    await read(K.saved, [], isSavedItems, 'saved items');
    await requireConsent(generation, work);
    assertCurrentWork(generation, work);
    await write(K.saved, records);
  });
}
export function getVisits(): Promise<VisitRecord[]> {
  return queued(() => read(K.visits, [], isVisits, 'visits'));
}
/** Full-snapshot replacement, not an incremental merge. */
export function setVisits(records: VisitRecord[], work?: ConsentWork): Promise<void> {
  const generation = work?.generation ?? currentConsentGeneration();
  return queued(async () => {
    requireValid(records, isVisits, 'visits');
    await read(K.visits, [], isVisits, 'visits');
    await requireConsent(generation, work);
    assertCurrentWork(generation, work);
    await write(K.visits, records);
  });
}
/** FR-05: records a product visit. The same product within 30 minutes counts once; history keeps 30 days. */
export function recordVisit(productId: string, now = Date.now()): Promise<void> {
  const generation = currentConsentGeneration();
  return queued(async () => {
    const visits = await read(K.visits, [], isVisits, 'visits');
    const keep = (times: number[]) => times.filter(time => now - time <= 30 * 86_400_000);
    const current = visits.find(visit => visit.productId === productId);
    const times = keep(current?.times ?? []);
    if (times.some(time => now - time < 30 * 60_000)) return;
    const next = visits.filter(visit => visit.productId !== productId)
      .map(visit => ({ ...visit, times: keep(visit.times) })).filter(visit => visit.times.length > 0);
    next.push({ productId, times: [...times, now] });
    await requireConsent(generation);
    assertCurrentWork(generation);
    await write(K.visits, next.slice(-500));
  });
}
export function getClassificationCache(): Promise<ClassificationCache> {
  return queued(() => read(K.classificationCache, {}, isCache, 'classification cache'));
}
/** Full-snapshot replacement, not an incremental merge. */
export function setClassificationCache(cache: ClassificationCache, work?: ConsentWork): Promise<void> {
  const generation = work?.generation ?? currentConsentGeneration();
  return queued(async () => {
    requireValid(cache, isCache, 'classification cache');
    await read(K.classificationCache, {}, isCache, 'classification cache');
    await requireConsent(generation, work);
    assertCurrentWork(generation, work);
    await write(K.classificationCache, cache);
  });
}
/** Atomic cache upsert for background classification; never merge snapshots in a client. */
export function cacheClassification(key: string, classification: import('../shared/types').Classification, work: ConsentWork): Promise<void> {
  return queued(async () => {
    requireValid(key, isNonemptyString, 'cache key');
    requireValid({ [key]: classification }, isCache, 'classification cache');
    const cache = await read(K.classificationCache, {}, isCache, 'classification cache');
    await requireConsent(work.generation, work);
    assertCurrentWork(work.generation, work);
    await write(K.classificationCache, { ...cache, [key]: classification });
  });
}
export function deleteAllUnhaulData(): Promise<void> {
  invalidateConsentWork();
  return queued(async () => {
    const data = await browser.storage.local.get(null);
    const keys = Object.keys(data).filter(key => key.startsWith('unhaul:') || key === LEGACY_ITEMS_KEY);
    if (keys.length) await browser.storage.local.remove(keys);
    const session = await browser.storage.session.get(null);
    const sessionKeys = Object.keys(session).filter(key => key.startsWith('unhaul:'));
    if (sessionKeys.length) await browser.storage.session.remove(sessionKeys);
    // Reads return defaults without recreating keys. There is no in-memory classification cache.
  }, false);
}
export const repo = {
  initializeStorage, getSettings, setConsent, setCooldownLock, getCooldownLock, getItems, addItem, deleteItem, loadSampleItems,
  getSavedItems, saveProduct, decideSavedItem, setSavedItems, getVisits, setVisits, recordVisit,
  getClassificationCache, setClassificationCache, deleteAllUnhaulData,
};

/** Per-tab session markers survive MV3 worker suspension and document reloads. */
export function claimPanelOpen(tabId: number, productId: string): Promise<boolean> {
  const generation = currentConsentGeneration();
  return queued(async () => {
    if (!Number.isSafeInteger(tabId) || tabId < 0 || !productId || productId.length > 2048) throw new Error('Invalid panel session.');
    const key = `unhaul:panel-open:${tabId}`;
    const data = await browser.storage.session.get(key);
    const ids: unknown = data[key] ?? [];
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw new Error('Invalid panel session data.');
    await requireConsent(generation);
    assertCurrentWork(generation);
    if (ids.includes(productId) || ids.length >= 500) return false;
    await browser.storage.session.set({ [key]: [...ids, productId] });
    return true;
  });
}
export function clearPanelSession(tabId: number): Promise<void> {
  return queued(() => browser.storage.session.remove(`unhaul:panel-open:${tabId}`), false);
}
