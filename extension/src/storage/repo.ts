import { browser } from 'wxt/browser';
import { CATEGORIES } from '../shared/lists';
import { DEFAULT_SETTINGS, type OwnedItem, type Settings } from '../shared/types';
import { LEGACY_ITEMS_KEY, STORAGE_KEYS } from './keys';

function assertSettings(value: unknown): asserts value is Settings {
  if (!value || typeof value !== 'object'
    || !('schemaVersion' in value) || value.schemaVersion !== 1
    || !('consentGiven' in value) || typeof value.consentGiven !== 'boolean') {
    throw new Error('Invalid or unsupported Unhaul settings; stored data was not replaced.');
  }
}

function assertItems(value: unknown): asserts value is OwnedItem[] {
  const ids = new Set<string>();
  if (!Array.isArray(value) || !value.every(item => {
    if (!item || typeof item !== 'object'
      || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim()
      || !CATEGORIES.includes(item.category)
      || typeof item.itemType !== 'string' || !item.itemType.trim()
      || (item.purpose !== undefined && typeof item.purpose !== 'string')
      || (item.notes !== undefined && typeof item.notes !== 'string')) return false;
    ids.add(item.id);
    return true;
  })) {
    throw new Error('Invalid Unhaul items; stored data was not replaced.');
  }
}

/** Compare records without depending on property insertion order. */
function equivalent(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && equivalent(a[key], b[key]));
}

// Serialize operations within this extension context, including concurrent lifecycle events.
// Cross-context mutation routing belongs to the later background storage-wrapper phase.
let pending: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}

async function initialize(): Promise<void> {
  const data = await browser.storage.local.get([
    STORAGE_KEYS.settings, STORAGE_KEYS.items, LEGACY_ITEMS_KEY,
  ]);
  const updates: Record<string, unknown> = {};
  if (Object.hasOwn(data, STORAGE_KEYS.settings)) {
    assertSettings(data[STORAGE_KEYS.settings]);
  } else {
    updates[STORAGE_KEYS.settings] = { ...DEFAULT_SETTINGS };
  }

  const hasItems = Object.hasOwn(data, STORAGE_KEYS.items);
  if (hasItems) assertItems(data[STORAGE_KEYS.items]);
  const hasLegacy = Object.hasOwn(data, LEGACY_ITEMS_KEY);
  if (hasLegacy) {
    const legacy: unknown = data[LEGACY_ITEMS_KEY];
    assertItems(legacy);
    const current = hasItems ? data[STORAGE_KEYS.items] as OwnedItem[] : [];
    const merged = new Map(current.map(item => [item.id, item]));
    for (const item of legacy) {
      const existing = merged.get(item.id);
      if (existing && !equivalent(existing, item)) {
        throw new Error(`Conflicting legacy Unhaul item ID: ${item.id}; both records were retained.`);
      }
      if (!existing) merged.set(item.id, item);
    }
    updates[STORAGE_KEYS.items] = [...merged.values()];
  }

  // Validate all data before writing anything; only remove legacy data after a successful copy.
  if (Object.keys(updates).length) await browser.storage.local.set(updates);
  if (hasLegacy) await browser.storage.local.remove(LEGACY_ITEMS_KEY);
}

/** Creates missing defaults and safely migrates scaffold items; errors propagate to callers. */
export function initializeStorage(): Promise<void> {
  return serialized(initialize);
}

export const repo = {
  async getItems(): Promise<OwnedItem[]> {
    return serialized(async () => {
      // Also covers options opened before an installation/startup callback completes.
      await initialize();
      const data = await browser.storage.local.get(STORAGE_KEYS.items);
      if (!Object.hasOwn(data, STORAGE_KEYS.items)) return [];
      const items: unknown = data[STORAGE_KEYS.items];
      assertItems(items);
      return items;
    });
  },
  async setItems(items: OwnedItem[]): Promise<void> {
    assertItems(items);
    return serialized(async () => {
      await initialize();
      await browser.storage.local.set({ [STORAGE_KEYS.items]: items });
    });
  },
};
