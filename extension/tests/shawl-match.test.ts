import { expect, test } from 'vitest';
import { classifyKeywords } from '../src/classify/keywords';
import { findMatches } from '../src/match/match';
import type { OwnedItem } from '../src/shared/types';

const product = classifyKeywords('Embroidered Shawl - ST1SE-LUXE26WV1-4');
const item = (over: Partial<OwnedItem>): OwnedItem => ({ id: 'a', name: 'Embroidered shawl', category: 'clothing_accessories',
  itemType: 'outerwear', purpose: 'wearing', source: 'manual', createdAt: 1, ...over } as OwnedItem);

test('shawl title classifies as outerwear', () => expect(product.itemType).toBe('outerwear'));
test('shawl matches a saved shawl of the same type', () => expect(findMatches(product, [item({})]).totalMatches).toBe(1));
test('shawl matches a saved item named shawl under another type', () =>
  expect(findMatches(product, [item({ itemType: 'top' })]).totalMatches).toBe(1));
test('unrelated saved item still does not match', () =>
  expect(findMatches(product, [item({ name: 'Blue kurta', itemType: 'top' })]).totalMatches).toBe(0));
