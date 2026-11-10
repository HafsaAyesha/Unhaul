/** Background-only storage implementation. UI/content must use client.ts. */
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type Settings, type OwnedItem, type SavedItem, type VisitRecord, type ClassificationCache } from '../shared/types';
import { isSettings, isItems, isOwnedItem, isSavedItem, isSavedItems, isVisits, isCache, isNonemptyString, requireValid } from '../shared/storage-validation';
import { LEGACY_ITEMS_KEY, STORAGE_KEYS as K } from './keys';
import { sampleItems } from './sample-items';
<<<<<<< HEAD
import { createConsentWork, currentConsentGeneration, invalidateConsentWork, isCurrentConsentWork, type ConsentWork } from '../consent/work';
=======
import { isReady, computeInsights, waitDeadline } from './insights';
export { WAIT_MS, waitDeadline, isReady, computeInsights } from './insights';
>>>>>>> 38a0ce5 (cleaning)

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
    if (items.some(existing => existing.id === item.id)) return;
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
    await browser.alarms?.clearAll?.();
    await browser.action?.setBadgeText?.({ text: '' });
  }, false);
}

const VISIT_DEDUP_MS = 30 * 60 * 1000;
const ALARM_PREFIX = 'unhaul-saved:';

async function persistNotified(id: string): Promise<void> {
  const records = await read(K.saved, [], isSavedItems, 'saved items');
  const next = records.map(item => item.id === id ? { ...item, notifiedAt: Date.now() } : item);
  await write(K.saved, next);
}
async function notifyReady(item: SavedItem): Promise<void> {
  if (item.notifiedAt || !isReady(item)) return;
  await browser.notifications?.create?.(`unhaul-${item.id}`, {
    type: 'basic', iconUrl: 'icon/128.png', title: 'Unhaul',
    message: `${item.product.title} is Ready to reconsider.`,
  });
  await persistNotified(item.id);
}
export async function updateReadyBadge(records: SavedItem[]): Promise<void> {
  const n = records.filter(item => isReady(item)).length;
  await browser.action?.setBadgeText?.({ text: n ? String(n) : '' });
}
export async function scheduleSavedAlarm(item: SavedItem): Promise<void> {
  const deadline = item.deadline === undefined ? item.reconsiderAt : item.deadline;
  if (item.status !== 'waiting' || deadline == null) return;
  if (deadline <= Date.now()) { await notifyReady(item); return; }
  await browser.alarms?.create?.(`${ALARM_PREFIX}${item.id}`, { when: deadline });
}
export async function rescheduleReminders(): Promise<void> {
  const alarms = await browser.alarms?.getAll?.() ?? [];
  for (const alarm of alarms) {
    if (alarm.name.startsWith(ALARM_PREFIX)) await browser.alarms?.clear?.(alarm.name);
  }
  const items = await getSavedItems();
  for (const item of items) await scheduleSavedAlarm(item);
  await updateReadyBadge(await getSavedItems());
}
export async function handleSavedAlarm(name: string): Promise<void> {
  if (!name.startsWith(ALARM_PREFIX)) return;
  const id = name.slice(ALARM_PREFIX.length);
  const item = (await getSavedItems()).find(entry => entry.id === id);
  if (item) await notifyReady(item);
  await updateReadyBadge(await getSavedItems());
}

export function upsertSaved(item: SavedItem): Promise<{ result: 'saved' | 'already_saved'; deadline: number | null }> {
  return queued(async () => {
    requireValid(item, isSavedItem, 'saved item');
    const records = await read(K.saved, [], isSavedItems, 'saved items');
    const existing = records.find(entry => entry.id === item.id);
    if (existing?.status === 'waiting') {
      const deadline = existing.deadline === undefined ? existing.reconsiderAt : existing.deadline ?? null;
      return { result: 'already_saved' as const, deadline };
    }
    const deadline = item.deadline === undefined ? item.reconsiderAt : item.deadline ?? null;
    const next = existing
      ? { ...item, decidedAt: existing.decidedAt, notifiedAt: existing.notifiedAt, status: existing.status }
      : item;
    const merged = existing ? records.map(entry => entry.id === item.id ? next : entry) : [...records, next];
    await write(K.saved, merged);
    if (next.status === 'waiting') await scheduleSavedAlarm(next);
    await updateReadyBadge(merged);
    return { result: 'saved' as const, deadline };
  });
}
export function setSavedStatus(id: string, status: SavedItem['status']): Promise<void> {
  return queued(async () => {
    requireValid(id, isNonemptyString, 'item ID');
    const records = await read(K.saved, [], isSavedItems, 'saved items');
    const next = records.map(item => item.id === id
      ? { ...item, status, decidedAt: status === 'waiting' ? item.decidedAt : Date.now() }
      : item);
    await write(K.saved, next);
    await updateReadyBadge(next);
  });
}
export function recordVisit(productId: string): Promise<void> {
  return queued(async () => {
    requireValid(productId, isNonemptyString, 'product ID');
    const records = await read(K.visits, [], isVisits, 'visits');
    const now = Date.now();
    const existing = records.find(entry => entry.productId === productId);
    if (existing) {
      const last = existing.timestamps[existing.timestamps.length - 1] ?? 0;
      if (now - last < VISIT_DEDUP_MS) return;
      await write(K.visits, records.map(entry => entry.productId === productId
        ? { ...entry, timestamps: [...entry.timestamps, now] } : entry));
      return;
    }
    await write(K.visits, [...records, { productId, timestamps: [now] }]);
  });
}
export function setMonthlyBudget(monthlyBudget: number | null): Promise<void> {
  return queued(async () => {
    if (monthlyBudget !== null && !(typeof monthlyBudget === 'number' && Number.isFinite(monthlyBudget) && monthlyBudget >= 0)) {
      throw new Error('Budget must be a non-negative number or null.');
    }
    const settings = await read(K.settings, { ...DEFAULT_SETTINGS }, isSettings, 'Unhaul settings');
    await write(K.settings, { ...settings, monthlyBudget });
  });
}
export const repo = {
  initializeStorage, getSettings, setConsent, getItems, addItem, deleteItem, loadSampleItems,
  getSavedItems, setSavedItems, getVisits, setVisits,
  getClassificationCache, setClassificationCache, deleteAllUnhaulData,
  upsertSaved, recordVisit, setSavedStatus, setMonthlyBudget, computeInsights, isReady, waitDeadline,
};
