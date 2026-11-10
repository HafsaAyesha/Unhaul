// src/storage/keys.ts
export const KEYS = {
  settings: 'unhaul:settings',     // Settings
  owned: 'unhaul:owned',           // OwnedItem[]
  saved: 'unhaul:saved',           // SavedItem[]
  visits: 'unhaul:visits',         // Record<productId, Visit>
  classCache: 'unhaul:class',      // Record<productId, Classification>
} as const;
