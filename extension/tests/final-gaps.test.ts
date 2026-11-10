import { describe, expect, it } from 'vitest';
import { formatPrice } from '../src/ui/price';
import { remainingLabel } from '../src/shared/cooling';
import type { SavedItem } from '../src/shared/types';

const item = (deadline: number): SavedItem => ({
  id: 's1', wait: '24h', savedAt: 0, deadline, status: 'waiting',
  product: { store: 'soz.com.pk', productId: 'https://soz.com.pk/products/mug', url: 'https://soz.com.pk/products/mug', title: 'Mug', price: 1800, wasPrice: null, currency: 'PKR', imageUrl: null },
});

describe('final display rules', () => {
  it('formats PKR prices and shows nothing when missing', () => {
    expect(formatPrice(1800, 'PKR')).toBe('PKR 1,800');
    expect(formatPrice(null, 'PKR')).toBe('');
    expect(formatPrice(1800, null)).toBe('');
  });
  it('words the countdown and Ready', () => {
    const day = 86_400_000, hour = 3_600_000, minute = 60_000;
    expect(remainingLabel(item(2 * day + 4 * hour), 0)).toBe('2 days 4 hours');
    expect(remainingLabel(item(3 * hour + 10 * minute), 0)).toBe('3 hours 10 minutes');
    expect(remainingLabel(item(10_000), 10_000 - 1)).toBe('less than a minute');
    expect(remainingLabel(item(10_000), 10_000)).toBe('Ready to decide');
  });
});

import { isProductRequest } from '../src/shared/messages';
import { EXAMPLE_PRODUCT as exampleProduct } from '../src/shared/examples';
describe('dev-only 1-minute wait', () => {
  it('accepts devTestWait in dev builds and still requires a normal wait key', () => {
    expect(isProductRequest({ type: 'SAVE_ITEM', product: exampleProduct, wait: '24h', devTestWait: true })).toBe(import.meta.env.DEV);
    expect(isProductRequest({ type: 'SAVE_ITEM', product: exampleProduct, wait: '1m', devTestWait: true })).toBe(false);
  });
});
