// src/shared/messages.ts
import type { Product, Classification, Match } from './types';
import type { WaitKey } from './lists';

export type Request =
  | { type: 'PING' }
  | { type: 'GET_CONSENT' }
  | { type: 'PRODUCT_SEEN'; product: Product }
  | { type: 'ADD_TO_CART_CLICKED'; productId: string }
  | { type: 'SAVE_ITEM'; product: Product; wait: WaitKey };

export type Response =
  | { type: 'PONG' }
  | { type: 'CONSENT'; given: boolean }
  | {
      type: 'MATCH_RESULT';
      productId: string;
      classification: Classification;
      matches: Match[];          // up to 3
      question: string;
      repeatVisit: boolean;
    }
  | { type: 'OK' }
  | { type: 'SAVE_RESULT'; result: 'saved' | 'already_saved'; deadline: number };

// Reply map: gives each request its exact reply type.
export interface ReplyFor {
  PING: Extract<Response, { type: 'PONG' }>;
  GET_CONSENT: Extract<Response, { type: 'CONSENT' }>;
  PRODUCT_SEEN: Extract<Response, { type: 'MATCH_RESULT' }>;
  ADD_TO_CART_CLICKED: Extract<Response, { type: 'OK' }>;
  SAVE_ITEM: Extract<Response, { type: 'SAVE_RESULT' }>;
}

// Typed send helper for the content script and options page.
export function send<T extends Request['type']>(
  req: Extract<Request, { type: T }>,
): Promise<ReplyFor[T]> {
  return chrome.runtime.sendMessage(req);
}
