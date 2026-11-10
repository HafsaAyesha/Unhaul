import type { Classification, OwnedItem } from '../shared/types';
export function matchItems(product: Classification, items: OwnedItem[]): OwnedItem[] {
  if (product.itemType === 'unknown') return [];
  return items.filter(item => item.category === product.category && item.itemType === product.itemType);
}
