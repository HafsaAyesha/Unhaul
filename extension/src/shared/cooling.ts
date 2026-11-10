import type { Product, SavedItem } from './types';
/** Stable product/variant identity, separate from a particular save/decision record ID. */
export function savedProductIdentity(product: Product): string {
  return JSON.stringify([product.store.toLowerCase(), product.productId, product.variantId ?? null]);
}
export function coolingState(item: SavedItem, now = Date.now()): { remainingMs: number; ready: boolean } {
  const deadline = item.reconsiderAt ?? item.deadline;
  if (!Number.isSafeInteger(deadline) || deadline < item.savedAt) throw new Error('Invalid saved-item deadline.');
  const remainingMs = Math.max(0, deadline - now);
  return { remainingMs, ready: item.status === 'waiting' && remainingMs === 0 };
}
export function remainingLabel(item: SavedItem, now = Date.now()): string {
  if (item.status !== 'waiting') return item.status === 'skipped' ? 'Skipped' : 'Purchased (self-reported)';
  const state = coolingState(item, now);
  if (state.ready) return 'Ready';
  const minutes = Math.ceil(state.remainingMs / 60_000);
  const days = Math.floor(minutes / 1440); const hours = Math.floor(minutes % 1440 / 60);
  return `${days ? `${days}d ` : ''}${hours ? `${hours}h ` : ''}${minutes % 60 || (!days && !hours) ? `${minutes % 60}m ` : ''}remaining`.trim();
}
