import type { Product, SavedItem } from './types';
import type { StorageRequest } from './storage-messages';
export type PingMessage = { type: 'PING' };
export type PongMessage = { type: 'PONG' };

function hasType(value: unknown, type: string): boolean {
  return typeof value === 'object' && value !== null
    && 'type' in value && value.type === type;
}
export function isPingMessage(value: unknown): value is PingMessage {
  return hasType(value, 'PING');
}
export function isPongMessage(value: unknown): value is PongMessage {
  return hasType(value, 'PONG');
}

export type Message =
  | PingMessage
  | StorageRequest
  | { type: 'PRODUCT_VIEWED'; product: Product }
  | { type: 'GET_PRODUCT_ANALYSIS'; product: Product }
  | { type: 'SAVE_FOR_LATER'; product: Product; waitDays: 1 | 3 | 7 }
  | { type: 'GET_SAVED_ITEMS' }
  | { type: 'UPDATE_SAVED_STATUS'; id: string; status: SavedItem['status'] }
  | { type: 'DELETE_ALL_DATA' };
// Add runtime validation before accepting messages from content scripts.

export type { StorageRequest, StorageResponse, StorageArguments, StorageResults } from './storage-messages';
export { isStorageRequest, isStorageResponse } from './storage-messages';
