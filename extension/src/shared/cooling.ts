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
  if (state.ready) return 'Ready to decide';
  if (state.remainingMs < 60_000) return 'less than a minute';
  const minutes = Math.floor(state.remainingMs / 60_000);
  const days = Math.floor(minutes / 1440); const hours = Math.floor(minutes % 1440 / 60); const mins = minutes % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  // At most two units: '2 days 4 hours', '3 hours 10 minutes', '25 minutes'.
  if (days) return hours ? `${unit(days, 'day')} ${unit(hours, 'hour')}` : unit(days, 'day');
  if (hours) return mins ? `${unit(hours, 'hour')} ${unit(mins, 'minute')}` : unit(hours, 'hour');
  return unit(mins, 'minute');
}
