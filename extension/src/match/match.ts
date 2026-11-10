import type { Classification, OwnedItem } from '../shared/types';
/** Same item type only for now; Phase 6 adds weak matches and reasons. */
export function matchItems(product: Classification, items: OwnedItem[]): OwnedItem[] {
  if (product.itemType === 'other') return [];
  return items.filter(item => item.category === product.category && item.itemType === product.itemType);
}
