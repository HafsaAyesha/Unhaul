import { CATEGORIES } from './lists';
import type { Settings, OwnedItem, SavedItem, VisitRecord, ClassificationCache, Classification, Product } from './types';
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const optionalText = (value: unknown) => value === undefined || typeof value === 'string';
const time = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const webURL = (value: unknown) => {
  if (!text(value)) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};
export function isSettings(value: unknown): value is Settings {
  return record(value) && value.schemaVersion === 1 && typeof value.consentGiven === 'boolean';
}
export function isClassification(value: unknown): value is Classification {
  return record(value) && CATEGORIES.some(category => category === value.category)
    && text(value.itemType) && optionalText(value.purpose);
}
export function isOwnedItem(value: unknown): value is OwnedItem {
  return record(value) && isClassification(value) && text(value.id) && text(value.name) && optionalText(value.notes);
}
export function isProduct(value: unknown): value is Product {
  return record(value) && text(value.store) && text(value.id) && text(value.title) && webURL(value.url)
    && optionalText(value.variantId) && optionalText(value.currency)
    && (value.image === undefined || webURL(value.image))
    && (value.price === undefined || (typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0));
}
export function isSavedItem(value: unknown): value is SavedItem {
  return record(value) && text(value.id) && isProduct(value.product)
    && time(value.savedAt) && time(value.reconsiderAt) && value.reconsiderAt >= value.savedAt
    && typeof value.status === 'string' && ['waiting', 'skipped', 'purchased'].includes(value.status);
}
export function isVisit(value: unknown): value is VisitRecord {
  return record(value) && text(value.productId) && Array.isArray(value.timestamps) && value.timestamps.every(time);
}
function uniqueArray<T>(value: unknown, guard: (entry: unknown) => entry is T, id: (entry: T) => string): value is T[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every(entry => {
    if (!guard(entry) || ids.has(id(entry))) return false;
    ids.add(id(entry)); return true;
  });
}
export const isItems = (value: unknown): value is OwnedItem[] => uniqueArray(value, isOwnedItem, item => item.id);
export const isSavedItems = (value: unknown): value is SavedItem[] => uniqueArray(value, isSavedItem, item => item.id);
export const isVisits = (value: unknown): value is VisitRecord[] => uniqueArray(value, isVisit, item => item.productId);
export function isCache(value: unknown): value is ClassificationCache {
  return record(value) && Object.entries(value).every(([key, entry]) => text(key) && record(entry)
    && isClassification(entry.classification) && typeof entry.source === 'string' && ['ai', 'keywords'].includes(entry.source) && time(entry.cachedAt));
}
export function requireValid<T>(value: unknown, guard: (value: unknown) => value is T, label: string): T {
  if (!guard(value)) throw new Error(`Invalid or unsupported ${label}; stored data was not replaced.`);
  return value;
}
export const isNonemptyString = text;
