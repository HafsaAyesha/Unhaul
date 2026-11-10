import { browser } from 'wxt/browser';
// src/shared/messages.ts
import type { Product, Classification, Match } from './types';
import { WAITS, type WaitKey } from './lists';
import { record, isProduct, isNonemptyString } from './storage-validation';

export type GetConsentMessage = { type: 'GET_CONSENT' };
export type ConsentResponse = { consentGiven: boolean };
export type ProductOperationError = { type: 'ERROR'; code: 'INVALID_REQUEST' | 'CONSENT_REQUIRED' | 'NOT_IMPLEMENTED'; message: string };
export function isGetConsentMessage(value: unknown): value is GetConsentMessage {
  return record(value) && value.type === 'GET_CONSENT' && Object.keys(value).length === 1;
}
export function isConsentResponse(value: unknown): value is ConsentResponse {
  return record(value) && typeof value.consentGiven === 'boolean';
}

export type Request =
  | { type: 'PING' }
  | GetConsentMessage
  | { type: 'PRODUCT_SEEN'; product: Product }
  | { type: 'ADD_TO_CART_CLICKED'; productId: string }
  | { type: 'SAVE_ITEM'; product: Product; wait: WaitKey };

export type Response =
  | { type: 'PONG' }
  | ConsentResponse
  | ProductOperationError
  | {
      type: 'MATCH_RESULT';
      productId: string;
      classification: Classification;
      matches: Match[];          // up to 3
      question: string;
      repeatVisit: boolean;
      alreadySaved?: boolean;    // product is already on the cooling-off list
    }
  | { type: 'OK' }
  | { type: 'SAVE_RESULT'; result: 'saved' | 'already_saved'; deadline: number };

// Reply map: gives each request its exact reply type.
export interface ReplyFor {
  PING: Extract<Response, { type: 'PONG' }>;
  GET_CONSENT: ConsentResponse;
  PRODUCT_SEEN: Extract<Response, { type: 'MATCH_RESULT' }>;
  ADD_TO_CART_CLICKED: Extract<Response, { type: 'OK' }>;
  SAVE_ITEM: Extract<Response, { type: 'SAVE_RESULT' }>;
}

// Typed send helper for the content script and options page.
export async function send<T extends Request['type']>(
  req: Extract<Request, { type: T }>,
): Promise<ReplyFor[T]> {
  const reply: unknown = await browser.runtime.sendMessage(req);
  if (req.type === 'GET_CONSENT' && !isConsentResponse(reply)) throw new Error('Invalid consent response.');
  if (record(reply) && reply.type === 'ERROR') throw new Error(typeof reply.message === 'string' ? reply.message : 'Product operation denied.');
  return reply as ReplyFor[T];
}

function hasType(value: unknown, type: string): boolean {
  return typeof value === 'object' && value !== null
    && 'type' in value && (value as { type: unknown }).type === type;
}
export function isPingMessage(value: unknown): value is Extract<Request, { type: 'PING' }> {
  return hasType(value, 'PING');
}
export function isPongMessage(value: unknown): value is Extract<Response, { type: 'PONG' }> {
  return hasType(value, 'PONG');
}

export type { StorageRequest, StorageResponse, StorageArguments, StorageResults } from './storage-messages';
export { isStorageRequest, isStorageResponse } from './storage-messages';

export type ProductRequest = Extract<Request, { type: 'PRODUCT_SEEN' | 'ADD_TO_CART_CLICKED' | 'SAVE_ITEM' }>;
export function isProductRequest(value: unknown): value is ProductRequest {
  if (!record(value)) return false;
  switch (value.type) {
    case 'PRODUCT_SEEN': return isProduct(value.product);
    case 'ADD_TO_CART_CLICKED': return isNonemptyString(value.productId);
    case 'SAVE_ITEM': return isProduct(value.product) && typeof value.wait === 'string' && Object.hasOwn(WAITS, value.wait);
    default: return false;
  }
}
