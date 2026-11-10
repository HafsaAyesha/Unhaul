// src/storage/storage.ts
// All user data stays in chrome.storage.local. Nothing here touches the network.
import { KEYS } from './keys';
import type { Settings, OwnedItem, SavedItem, Visit, Classification } from '../shared/types';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

async function read<T>(key: string, fallback: T): Promise<T> {
  const r = await chrome.storage.local.get(key);
  return (r[key] as T | undefined) ?? fallback;
}

async function write<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// Settings
export const DEFAULT_SETTINGS: Settings = { schemaVersion: 1, consentGiven: false };

export function getSettings(): Promise<Settings> {
  return read(KEYS.settings, DEFAULT_SETTINGS);
}
export function saveSettings(s: Settings): Promise<void> {
  return write(KEYS.settings, s);
}

// Owned items
export function getOwned(): Promise<OwnedItem[]> {
  return read<OwnedItem[]>(KEYS.owned, []);
}
export async function addOwned(item: OwnedItem): Promise<void> {
  const all = await getOwned();
  all.push(item);
  await write(KEYS.owned, all);
}
export async function deleteOwned(id: string): Promise<void> {
  const all = await getOwned();
  await write(KEYS.owned, all.filter((x) => x.id !== id));
}

// Saved (cooling-off) items. id is the productId, so one product is kept once.
export function getSaved(): Promise<SavedItem[]> {
  return read<SavedItem[]>(KEYS.saved, []);
}
export async function upsertSaved(item: SavedItem): Promise<void> {
  const all = await getSaved();
  const i = all.findIndex((x) => x.id === item.id);
  if (i >= 0) all[i] = item;
  else all.push(item);
  await write(KEYS.saved, all);
}

// Visits, kept for 30 days. Returns the times including this one.
export async function recordVisit(productId: string): Promise<number[]> {
  const now = Date.now();
  const all = await read<Record<string, Visit>>(KEYS.visits, {});
  const times = (all[productId]?.times ?? []).filter((t) => now - t < THIRTY_DAYS);
  times.push(now);
  all[productId] = { productId, times };
  await write(KEYS.visits, all);
  return times;
}

// AI answer cache: each product goes to the AI once.
export async function getCachedClass(productId: string): Promise<Classification | undefined> {
  const all = await read<Record<string, Classification>>(KEYS.classCache, {});
  return all[productId];
}
export async function setCachedClass(productId: string, c: Classification): Promise<void> {
  const all = await read<Record<string, Classification>>(KEYS.classCache, {});
  all[productId] = c;
  await write(KEYS.classCache, all);
}

// Delete everything: items, saved list, visits, cache and settings (consent resets).
export async function deleteAll(): Promise<void> {
  await chrome.storage.local.clear();
}
