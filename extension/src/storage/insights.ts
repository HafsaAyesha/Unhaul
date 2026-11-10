import type { SavedItem } from '../shared/types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const WAIT_MS = { 1: DAY_MS, 3: 3 * DAY_MS, 7: 7 * DAY_MS } as const;

export function waitDeadline(savedAt: number, wait: 1 | 3 | 7 | null): number | null {
  return wait == null ? null : savedAt + WAIT_MS[wait];
}
export function isReady(item: SavedItem, now = Date.now()): boolean {
  if (item.status !== 'waiting') return false;
  const deadline = item.deadline === undefined ? item.reconsiderAt : item.deadline;
  return deadline != null && now >= deadline;
}
export function computeInsights(saved: SavedItem[], monthlyBudget: number | null | undefined, now = Date.now()) {
  const skipped = saved.filter(item => item.status === 'skipped');
  const purchased = saved.filter(item => item.status === 'purchased');
  const potentialAvoided = skipped.reduce((sum, item) => item.product.price == null ? sum : sum + item.product.price, 0);
  const start = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);
  const spendThisMonth = purchased.reduce((sum, item) => {
    if (item.product.price == null) return sum;
    const at = item.decidedAt ?? item.savedAt;
    return at >= start && at <= now ? sum + item.product.price : sum;
  }, 0);
  const hidden = monthlyBudget == null || !Number.isFinite(monthlyBudget);
  const remaining = hidden ? null : monthlyBudget - spendThisMonth;
  const overBudget = remaining != null && remaining < 0;
  const budgetShare = (price: number | null | undefined): number | null => {
    if (hidden || remaining == null) return null;
    if (remaining <= 0) return Number.POSITIVE_INFINITY;
    if (price == null) return 0;
    return price / remaining;
  };
  return { itemsSaved: saved.length, skipped: skipped.length, potentialAvoided, spendThisMonth, hidden, overBudget, remaining, budgetShare };
}
