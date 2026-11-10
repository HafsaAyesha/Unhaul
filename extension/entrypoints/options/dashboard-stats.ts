import { coolingState } from '../../src/shared/cooling';
import { CATEGORIES, type Category } from '../../src/shared/lists';
import type { OwnedItem, SavedItem } from '../../src/shared/types';

export interface DashboardStats {
  ownedByCategory: { category: Category; count: number }[];
  saved: { waiting: number; ready: number; skipped: number; purchased: number };
  notSpent: Record<string, number>;
  unpricedSkipped: number;
  recentDecisions: SavedItem[];
}

export function computeDashboard(items: OwnedItem[], saved: SavedItem[], now = Date.now()): DashboardStats {
  const counts = new Map<Category, number>();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  const ownedByCategory = CATEGORIES
    .filter(category => counts.has(category))
    .map(category => ({ category, count: counts.get(category)! }));
  const result = { waiting: 0, ready: 0, skipped: 0, purchased: 0 };
  const notSpent: Record<string, number> = {};
  let unpricedSkipped = 0;

  for (const item of saved) {
    if (item.status === 'skipped') {
      result.skipped++;
      if (item.product.price === null || !item.product.currency) unpricedSkipped++;
      else notSpent[item.product.currency] = (notSpent[item.product.currency] ?? 0) + item.product.price;
    } else if (item.status === 'purchased') {
      result.purchased++;
    } else {
      try {
        if (coolingState(item, now).ready) result.ready++;
        else result.waiting++;
      } catch {
        result.waiting++;
      }
    }
  }

  const recentDecisions = saved
    .filter(item => item.status === 'skipped' || item.status === 'purchased')
    .slice()
    .sort((a, b) => (b.decidedAt ?? b.savedAt) - (a.decidedAt ?? a.savedAt))
    .slice(0, 5);
  return { ownedByCategory, saved: result, notSpent, unpricedSkipped, recentDecisions };
}
