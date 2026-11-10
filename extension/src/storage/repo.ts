/** Background-only storage implementation. UI/content must use client.ts. */
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type Settings, type OwnedItem, type SavedItem, type VisitRecord, type ClassificationCache } from '../shared/types';
import { isSettings, isItems, isOwnedItem, isSavedItems, isVisits, isCache, isNonemptyString, requireValid } from '../shared/storage-validation';
import { LEGACY_ITEMS_KEY, STORAGE_KEYS as K } from './keys';
import { sampleItems } from './sample-items';
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
export function deleteAllUnhaulData(): Promise<void> {
  invalidateConsentWork();
  return queued(async () => {
    const data = await browser.storage.local.get(null);
    const keys = Object.keys(data).filter(key => key.startsWith('unhaul:') || key === LEGACY_ITEMS_KEY);
    if (keys.length) await browser.storage.local.remove(keys);
    // Reads return defaults without recreating keys. There is no in-memory classification cache.
  }, false);
}
export const repo = {
  initializeStorage, getSettings, setConsent, getItems, addItem, deleteItem, loadSampleItems,
  getSavedItems, setSavedItems, getVisits, setVisits,
  getClassificationCache, setClassificationCache, deleteAllUnhaulData,
};
