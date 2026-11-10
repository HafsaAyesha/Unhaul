import { describe, expect, it } from 'vitest';
import { computeDashboard } from '../entrypoints/options/dashboard-stats';
import { CATEGORIES, WAITS } from '../src/shared/lists';
import { EXAMPLE_PRODUCT, EXAMPLE_SAVED } from '../src/shared/examples';
import type { OwnedItem, SavedItem } from '../src/shared/types';

const owned = (category: OwnedItem['category'], id: string = category): OwnedItem => ({
  id, name: id, category, itemType: 'other', source: 'manual', createdAt: 1,
});
const saved = (overrides: Partial<SavedItem> = {}): SavedItem => ({
  ...EXAMPLE_SAVED,
  ...overrides,
  product: { ...EXAMPLE_PRODUCT, ...(overrides.product ?? {}) },
});

describe('computeDashboard', () => {
  it('orders owned categories according to CATEGORIES and skips zeros', () => {
    const result = computeDashboard([owned('other'), owned('stationery', 'two'), owned('stationery', 'three')], []);
    expect(result.ownedByCategory).toEqual([
      { category: CATEGORIES[0], count: 2 },
      { category: CATEGORIES[5], count: 1 },
    ]);
  });

  it('separates ready and waiting at the deadline boundary', () => {
    const now = 1760000000000 + WAITS['3d'];
    const result = computeDashboard([], [
      saved({ deadline: now, reconsiderAt: now }),
      saved({ id: 'later', deadline: now + 1, reconsiderAt: now + 1 }),
    ], now);
    expect(result.saved).toEqual({ waiting: 1, ready: 1, skipped: 0, purchased: 0 });
  });

  it('groups skipped prices by currency and counts unpriced records', () => {
    const result = computeDashboard([], [
      saved({ id: 'pkr', status: 'skipped', product: { ...EXAMPLE_PRODUCT, price: 1800, currency: 'PKR' } }),
      saved({ id: 'usd', status: 'skipped', product: { ...EXAMPLE_PRODUCT, price: 12.5, currency: 'USD' } }),
      saved({ id: 'none', status: 'skipped', product: { ...EXAMPLE_PRODUCT, price: null, currency: null } }),
    ]);
    expect(result.notSpent).toEqual({ PKR: 1800, USD: 12.5 });
    expect(result.unpricedSkipped).toBe(1);
  });

  it('limits recent decisions to five in newest-first order', () => {
    const records = Array.from({ length: 6 }, (_, index) => saved({
      id: `decision-${index}`, status: index % 2 ? 'purchased' : 'skipped', decidedAt: 100 + index,
    }));
    expect(computeDashboard([], records).recentDecisions.map(item => item.id)).toEqual([
      'decision-5', 'decision-4', 'decision-3', 'decision-2', 'decision-1',
    ]);
  });

  it('counts an invalid deadline as waiting', () => {
    const result = computeDashboard([], [saved({ deadline: 0, reconsiderAt: 0, savedAt: 1 })]);
    expect(result.saved.waiting).toBe(1);
    expect(result.saved.ready).toBe(0);
  });
});
