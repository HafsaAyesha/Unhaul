// src/shared/examples.ts
// Made-up records for building and testing. No real person's data.
import type { Product, Classification, OwnedItem, SavedItem } from './types';
import { WAITS } from './lists';

export const EXAMPLE_PRODUCT: Product = {
  store: 'example-store.pk',
  productId: 'https://example-store.pk/products/blue-ceramic-mug',
  url: 'https://example-store.pk/products/blue-ceramic-mug?utm_source=ad',
  title: 'Blue Ceramic Mug',
  price: 1800,
  wasPrice: 2400,
  currency: 'PKR',
  imageUrl: 'https://example-store.pk/images/blue-mug.jpg',
  categoryText: 'Mugs home kitchen',
};

export const EXAMPLE_PRODUCT_NO_PRICE: Product = {
  store: 'example-store.pk',
  productId: 'https://example-store.pk/products/mystery-notebook',
  url: 'https://example-store.pk/products/mystery-notebook',
  title: 'A5 Dotted Notebook',
  price: null,
  wasPrice: null,
  currency: null,
  imageUrl: null,
};

export const EXAMPLE_CLASSIFICATION: Classification = {
  category: 'home_decor',
  itemType: 'mug',
  purpose: 'other',
  confidence: 0.9,
  source: 'keywords',
  classifiedAt: 1760000000000,
};

export const EXAMPLE_OWNED: OwnedItem = {
  id: 'sample-01',
  name: 'White coffee mug',
  category: 'home_decor',
  itemType: 'mug',
  purpose: 'other',
  source: 'sample',
  createdAt: 1760000000000,
};

export const EXAMPLE_SAVED: SavedItem = {
  id: EXAMPLE_PRODUCT.productId,
  product: EXAMPLE_PRODUCT,
  classification: EXAMPLE_CLASSIFICATION,
  wait: '3d',
  savedAt: 1760000000000,
  deadline: 1760000000000 + WAITS['3d'],
  status: 'waiting',
};
