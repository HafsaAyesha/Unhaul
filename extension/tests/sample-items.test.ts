import { expect, it } from 'vitest';
import { sampleItems } from '../src/storage/sample-items';
import { DEFAULT_PURPOSE, ITEM_TYPES, PURPOSES } from '../src/shared/lists';
import { isItems } from '../src/shared/storage-validation';

it('provides ten valid fictional samples, two per category, with stable unique IDs', () => {
  expect(sampleItems).toHaveLength(10);
  expect(new Set(sampleItems.map(item => item.id)).size).toBe(10);
  expect(isItems(sampleItems)).toBe(true);
  const counts: Record<string, number> = {};
  for (const [index, item] of sampleItems.entries()) {
    expect(item.id).toBe(`sample-${String(index + 1).padStart(2, '0')}`);
    expect(ITEM_TYPES[item.category] as readonly string[]).toContain(item.itemType);
    expect(PURPOSES).toContain(item.purpose);
    expect(DEFAULT_PURPOSE[item.itemType]).toBe(item.purpose);
    expect(item.notes).toBe('Fictional sample item');
    expect(item.source).toBe('sample');
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  expect(counts).toEqual({ stationery: 2, home_decor: 2, toys_games: 2, electronics: 2, clothing_accessories: 2 });
});
