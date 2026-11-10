export type Category = 'stationery' | 'home-decor' | 'toys-games' | 'electronics' | 'clothing-accessories' | 'other';
export interface Classification { category: Category; itemType: string; purpose?: string; }
export interface Product {
  store: string; id: string; variantId?: string; url: string; title: string;
  price?: number; currency?: string; image?: string;
}
export interface OwnedItem extends Classification { id: string; name: string; notes?: string; }
export interface SavedItem {
  id: string; product: Product; savedAt: number; reconsiderAt: number;
  status: 'waiting' | 'skipped' | 'purchased';
}
export interface VisitRecord { productId: string; timestamps: number[]; }
export interface Settings { schemaVersion: 1; consentGiven: boolean; }
export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  consentGiven: false,
};

/** Cache keys are stable product identities; entries contain public product classification only. */
export interface ClassificationCacheEntry {
  classification: Classification;
  source: 'ai' | 'keywords';
  cachedAt: number;
}
export type ClassificationCache = Record<string, ClassificationCacheEntry>;
