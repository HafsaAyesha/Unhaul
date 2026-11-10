import { CATEGORIES, ITEM_TYPES, PURPOSES, WAITS, type Category } from './lists';
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
  return record(value) && value.schemaVersion === 1 && typeof value.consentGiven === 'boolean'
    && (value.cooldownLock === undefined || typeof value.cooldownLock === 'boolean');
}
const inList = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value);
const nullable = <T>(value: unknown, guard: (v: unknown) => v is T | boolean) => value === null || guard(value);
const price = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function typeFits(category: unknown, itemType: unknown): boolean {
  return inList(CATEGORIES, category) && inList(ITEM_TYPES[category as Category] as readonly string[], itemType);
}
export function isClassification(value: unknown): value is Classification {
  return record(value) && typeFits(value.category, value.itemType) && inList(PURPOSES, value.purpose)
    && typeof value.confidence === 'number' && value.confidence >= 0 && value.confidence <= 1
    && inList(['ai', 'keywords'], value.source) && time(value.classifiedAt);
}
export function isOwnedItem(value: unknown): value is OwnedItem {
  return record(value) && text(value.id) && text(value.name) && typeFits(value.category, value.itemType)
    && (value.purpose === undefined || inList(PURPOSES, value.purpose)) && optionalText(value.notes)
    && inList(['sample', 'manual'], value.source) && time(value.createdAt);
}
export function isProduct(value: unknown): value is Product {
  return record(value) && text(value.store) && text(value.productId) && text(value.title) && webURL(value.url)
    && optionalText(value.variantId) && optionalText(value.categoryText)
    && nullable(value.price, price) && nullable(value.wasPrice, price)
    && (value.currency === null || text(value.currency))
    && (value.imageUrl === null || webURL(value.imageUrl));
}
export function isSavedItem(value: unknown): value is SavedItem {
  return record(value) && text(value.id) && isProduct(value.product)
    && (value.classification === undefined || isClassification(value.classification))
    && inList(Object.keys(WAITS), value.wait) && time(value.savedAt) && time(value.deadline)
    && value.deadline >= value.savedAt
    && (value.reconsiderAt === undefined || (time(value.reconsiderAt) && value.reconsiderAt === value.deadline))
    && inList(['waiting', 'skipped', 'purchased'], value.status)
    && (value.decidedAt === undefined || time(value.decidedAt));
}
export function isVisit(value: unknown): value is VisitRecord {
  return record(value) && text(value.productId) && Array.isArray(value.times) && value.times.every(time);
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
  return record(value) && Object.entries(value).every(([key, entry]) => text(key) && isClassification(entry));
}
export function requireValid<T>(value: unknown, guard: (value: unknown) => value is T, label: string): T {
  if (!guard(value)) throw new Error(`Invalid or unsupported ${label}; stored data was not replaced.`);
  return value;
}
export const isNonemptyString = text;
