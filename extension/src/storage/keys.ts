/** All persisted Unhaul records use this namespace. */
export const STORAGE_KEYS = {
  settings: 'unhaul:settings',
  items: 'unhaul:items',
  saved: 'unhaul:saved',
  visits: 'unhaul:visits',
  classificationCache: 'unhaul:classification-cache',
} as const;

/** The only unprefixed record written by the original scaffold. */
export const LEGACY_ITEMS_KEY = 'items';
