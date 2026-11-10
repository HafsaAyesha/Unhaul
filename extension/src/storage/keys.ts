// src/storage/keys.ts
// Every persisted Unhaul record lives under one of these keys (see context.md section 9).
export const KEYS = {
  settings: 'unhaul:settings',     // Settings
  owned: 'unhaul:owned',           // OwnedItem[]
  saved: 'unhaul:saved',           // SavedItem[]
  visits: 'unhaul:visits',         // Record<productId, Visit>
  classCache: 'unhaul:class',      // Record<productId, Classification>
} as const;

/** Older names used by repo.ts; they point at the same keys as KEYS. */
export const STORAGE_KEYS = {
  settings: KEYS.settings,
  items: KEYS.owned,
  saved: KEYS.saved,
  visits: KEYS.visits,
  classificationCache: KEYS.classCache,
} as const;

/** The only unprefixed record written by the original scaffold. */
export const LEGACY_ITEMS_KEY = 'items';
