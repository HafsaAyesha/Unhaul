import type { Settings, OwnedItem, SavedItem, VisitRecord, ClassificationCache } from './types';
import { record, isSettings, isItems, isOwnedItem, isSavedItems, isVisits, isCache, isNonemptyString } from './storage-validation';
export interface StorageArguments {
  initializeStorage: []; getSettings: []; setConsent: [boolean];
  getItems: []; addItem: [OwnedItem]; deleteItem: [string]; loadSampleItems: [];
  getSavedItems: []; setSavedItems: [SavedItem[]]; getVisits: []; setVisits: [VisitRecord[]];
  getClassificationCache: []; setClassificationCache: [ClassificationCache]; deleteAllUnhaulData: [];
}
export interface StorageResults {
  initializeStorage: null; getSettings: Settings; setConsent: null;
  getItems: OwnedItem[]; addItem: null; deleteItem: null; loadSampleItems: number;
  getSavedItems: SavedItem[]; setSavedItems: null; getVisits: VisitRecord[]; setVisits: null;
  getClassificationCache: ClassificationCache; setClassificationCache: null; deleteAllUnhaulData: null;
}
export type StorageOperation = keyof StorageArguments;
export type StorageRequest = { [K in StorageOperation]: {
  type: 'STORAGE'; operation: K; args: StorageArguments[K];
} }[StorageOperation];
export type StorageResponse<K extends StorageOperation = StorageOperation> =
  | { ok: true; value: StorageResults[K] }
  | { ok: false; error: { code: 'INVALID_REQUEST' | 'FORBIDDEN' | 'STORAGE_ERROR'; message: string } };
const noArguments = new Set(['initializeStorage', 'getSettings', 'getItems', 'loadSampleItems', 'getSavedItems', 'getVisits', 'getClassificationCache', 'deleteAllUnhaulData']);
export function isStorageRequest(value: unknown): value is StorageRequest {
  if (!record(value) || value.type !== 'STORAGE' || typeof value.operation !== 'string' || !Array.isArray(value.args)) return false;
  const args: unknown[] = value.args;
  if (noArguments.has(value.operation)) return args.length === 0;
  if (args.length !== 1) return false;
  switch (value.operation) {
    case 'setConsent': return typeof args[0] === 'boolean';
    case 'addItem': return isOwnedItem(args[0]);
    case 'deleteItem': return isNonemptyString(args[0]);
    case 'setSavedItems': return isSavedItems(args[0]);
    case 'setVisits': return isVisits(args[0]);
    case 'setClassificationCache': return isCache(args[0]);
    default: return false;
  }
}
export function isStorageResponse<K extends StorageOperation>(operation: K, value: unknown): value is StorageResponse<K> {
  if (!record(value)) return false;
  if (value.ok === false) return record(value.error)
    && ['INVALID_REQUEST', 'FORBIDDEN', 'STORAGE_ERROR'].includes(String(value.error.code)) && typeof value.error.message === 'string';
  if (value.ok !== true) return false;
  switch (operation) {
    case 'getSettings': return isSettings(value.value);
    case 'getItems': return isItems(value.value);
    case 'getSavedItems': return isSavedItems(value.value);
    case 'getVisits': return isVisits(value.value);
    case 'getClassificationCache': return isCache(value.value);
    case 'loadSampleItems': return typeof value.value === 'number' && Number.isSafeInteger(value.value) && value.value >= 0;
    default: return value.value === null;
  }
}
