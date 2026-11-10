import { browser } from 'wxt/browser';
// src/shared/messages.ts
import type { Product, AnalysisResult, SaveResult } from './types';
import { WAITS, type WaitKey } from './lists';
import { isAnalysisResult } from './analysis-validation';
import { record, isProduct, isSavedItem, isNonemptyString } from './storage-validation';

export type GetConsentMessage = { type: 'GET_CONSENT' };
export type ConsentResponse = { consentGiven: boolean };
export type CooldownRequest = { type: 'CHECK_COOLDOWN'; product: Product };
export type CooldownResponse = { type: 'COOLDOWN_RESULT'; locked: boolean; reconsiderAt?: number; remainingLabel?: string };
export type OpenUnhaulRequest = { type: 'OPEN_UNHAUL' };
export type SiteEnabledResponse = { type: 'SITE_ENABLED'; enabled: boolean };
export type CustomSitesResponse = { type: 'CUSTOM_SITES'; origins: string[] };
export type ProductOperationError = { type: 'ERROR'; code: 'INVALID_REQUEST' | 'CONSENT_REQUIRED' | 'NOT_IMPLEMENTED' | 'ANALYSIS_FAILED' | 'SAVE_FAILED'; message: string };
export function isGetConsentMessage(value: unknown): value is GetConsentMessage {
  return record(value) && value.type === 'GET_CONSENT' && Object.keys(value).length === 1;
}
export function isConsentResponse(value: unknown): value is ConsentResponse {
  return record(value) && typeof value.consentGiven === 'boolean';
}

export type Request =
  | { type: 'PING' }
  | GetConsentMessage
  | { type: 'IS_SITE_ENABLED' }
  | { type: 'LIST_CUSTOM_SITES' }
  | CooldownRequest
  | { type: 'PRODUCT_SEEN'; product: Product }
  | { type: 'REFINE_PRODUCT'; analysisId: string }
  | { type: 'CLAIM_PANEL_OPEN'; productId: string }
  | { type: 'ADD_TO_CART_CLICKED'; productId: string }
  | { type: 'SAVE_ITEM'; product: Product; wait: WaitKey; devTestWait?: true };  // devTestWait: dev builds only, 1-minute deadline

export type Response =
  | { type: 'PONG' }
  | ConsentResponse
  | CooldownResponse
  | SiteEnabledResponse
  | CustomSitesResponse
  | ProductOperationError
  | AnalysisResult
  | { type: 'PANEL_OPEN_PERMISSION'; allowed: boolean }
  | { type: 'OK' }
  | SaveResult;

// Reply map: gives each request its exact reply type.
export interface ReplyFor {
  PING: Extract<Response, { type: 'PONG' }>;
  GET_CONSENT: ConsentResponse;
  IS_SITE_ENABLED: SiteEnabledResponse;
  LIST_CUSTOM_SITES: CustomSitesResponse;
  CHECK_COOLDOWN: CooldownResponse;
  PRODUCT_SEEN: AnalysisResult;
  REFINE_PRODUCT: AnalysisResult;
  CLAIM_PANEL_OPEN: { type: 'PANEL_OPEN_PERMISSION'; allowed: boolean };
  ADD_TO_CART_CLICKED: Extract<Response, { type: 'OK' }>;
  SAVE_ITEM: SaveResult;
}

// Typed send helper for the content script and options page.
export async function send<T extends Request['type']>(
  req: Extract<Request, { type: T }>,
): Promise<ReplyFor[T]> {
  const reply: unknown = await browser.runtime.sendMessage(req);
  if (req.type === 'GET_CONSENT' && !isConsentResponse(reply)) throw new Error('Invalid consent response.');
  if (req.type === 'IS_SITE_ENABLED' && !isSiteEnabledResponse(reply)) throw new Error('Invalid site permission response.');
  if (req.type === 'LIST_CUSTOM_SITES' && !isCustomSitesResponse(reply)) throw new Error('Invalid custom sites response.');
  if (req.type === 'CHECK_COOLDOWN' && (!record(reply) || reply.type !== 'COOLDOWN_RESULT' || typeof reply.locked !== 'boolean')) throw new Error('Invalid cooldown response.');
  if (record(reply) && reply.type === 'ERROR') throw new Error(typeof reply.message === 'string' ? reply.message : 'Product operation denied.');
  if ((req.type === 'PRODUCT_SEEN' || req.type === 'REFINE_PRODUCT') && !isAnalysisResult(reply)) throw new Error('Invalid analysis response.');
  if (req.type === 'CLAIM_PANEL_OPEN' && (!record(reply) || reply.type !== 'PANEL_OPEN_PERMISSION' || typeof reply.allowed !== 'boolean')) throw new Error('Invalid panel permission response.');
  if (req.type === 'SAVE_ITEM' && (!record(reply) || reply.type !== 'SAVE_RESULT'
    || !['saved', 'already_saved'].includes(String(reply.result)) || !isSavedItem(reply.record)
    || reply.deadline !== (reply.record.reconsiderAt ?? reply.record.deadline))) throw new Error('Invalid save response.');
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
export function isSiteEnabledResponse(value: unknown): value is SiteEnabledResponse {
  return record(value) && value.type === 'SITE_ENABLED' && typeof value.enabled === 'boolean';
}
export function isCustomSitesResponse(value: unknown): value is CustomSitesResponse {
  return record(value) && value.type === 'CUSTOM_SITES' && Array.isArray(value.origins)
    && value.origins.every(origin => typeof origin === 'string');
}

export type { StorageRequest, StorageResponse, StorageArguments, StorageResults } from './storage-messages';
export { isStorageRequest, isStorageResponse } from './storage-messages';

export type ProductRequest = Extract<Request, { type: 'PRODUCT_SEEN' | 'REFINE_PRODUCT' | 'ADD_TO_CART_CLICKED' | 'SAVE_ITEM' | 'CHECK_COOLDOWN' }>;
export function isProductRequest(value: unknown): value is ProductRequest {
  if (!record(value)) return false;
  switch (value.type) {
    case 'PRODUCT_SEEN': return isProduct(value.product);
    case 'REFINE_PRODUCT': return isNonemptyString(value.analysisId);
    case 'ADD_TO_CART_CLICKED': return isNonemptyString(value.productId);
    case 'SAVE_ITEM': return isProduct(value.product) && typeof value.wait === 'string' && Object.hasOwn(WAITS, value.wait)
      && (value.devTestWait === undefined || (value.devTestWait === true && import.meta.env.DEV));
    case 'CHECK_COOLDOWN': return isProduct(value.product);
    default: return false;
  }
}
