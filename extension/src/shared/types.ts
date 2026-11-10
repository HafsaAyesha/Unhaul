// src/shared/types.ts
import type { Category, ItemType, Purpose, WaitKey } from './lists';

export interface Product {
  store: string;               // location.hostname, e.g. 'soz.com.pk'
  productId: string;           // origin + /products/handle, no query string, no collection path
  variantId?: string;
  url: string;
  title: string;
  price: number | null;        // null when missing. Never guess.
  wasPrice: number | null;     // crossed-out price. Set only when it is above price.
  currency: string | null;     // 'PKR'
  imageUrl: string | null;
  categoryText?: string;       // store type, breadcrumb and tags joined into one string
}

export interface Classification {
  category: Category;
  itemType: ItemType;
  purpose: Purpose;
  confidence: number;          // 0 to 1
  source: 'ai' | 'keywords';
  classifiedAt: number;        // Date.now()
}

export interface OwnedItem {
  id: string;                  // 'sample-01' or a random ID
  name: string;
  category: Category;
  itemType: ItemType;
  purpose?: Purpose;
  notes?: string;
  source: 'sample' | 'manual';
  createdAt: number;
}

export type SavedStatus = 'waiting' | 'skipped' | 'purchased';

export interface SavedItem {
  id: string;                  // unique save/decision record ID; legacy productId IDs remain valid
  product: Product;            // snapshot at save time
  classification?: Classification;
  wait: WaitKey;
  savedAt: number;
  deadline: number;            // legacy-compatible absolute deadline
  reconsiderAt?: number;       // new records write this equal to deadline
  status: SavedStatus;
  decidedAt?: number;
}
// "Ready" is never stored. It is waiting + Date.now() >= deadline.

export interface Visit {
  productId: string;
  times: number[];             // timestamps, kept for 30 days
}

export interface Settings {
  schemaVersion: 1;
  consentGiven: boolean;
  consentAt?: number;
}

export interface Match {
  item: OwnedItem;
  strength: 'strong' | 'weak';
  reason: string;              // 'Same type: notebook'
}

export const DEFAULT_SETTINGS: Settings = { schemaVersion: 1, consentGiven: false };

/** Names used by the storage layer. */
export type VisitRecord = Visit;
/** Keyed by productId; each entry already records whether it came from AI or keywords. */
export type ClassificationCache = Record<string, Classification>;

/** Basic analysis is returned immediately; AI refinement is requested separately. */
export interface AnalysisResult {
  type: 'MATCH_RESULT';
  productId: string;
  analysisId: string;
  classification: Classification;
  matches: Match[];
  totalMatches: number;
  question: string;
  repeatVisit: boolean;
  phase: 'basic' | 'cached' | 'ai' | 'fallback';
  refinementAvailable: boolean;
}

export interface SaveResult {
  type: 'SAVE_RESULT';
  result: 'saved' | 'already_saved';
  deadline: number;
  record: SavedItem;
}
