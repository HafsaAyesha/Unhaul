import { describe, expect, it } from 'vitest';
import { classifyKeywords } from '../src/classify/keywords';
import { isClassification } from '../src/classify/validate';
import { matchItems } from '../src/match/match';
import { sampleItems } from '../src/storage/sample-items';
describe('classification and matching contracts', () => {
  it('finds a journal while excluding other categories', () => {
    expect(matchItems(classifyKeywords('A5 dotted journal'), sampleItems).map(item => item.id)).toEqual(['sample-journal']);
  });
  it('does not match unknown products', () => {
    expect(matchItems(classifyKeywords('Mystery item'), sampleItems)).toEqual([]);
  });
  it('rejects malformed AI classifications', () => {
    expect(isClassification({ category: 'invented', itemType: 'journal' })).toBe(false);
    expect(isClassification({ category: 'stationery', itemType: '' })).toBe(false);
    expect(isClassification({ category: 'stationery', itemType: 'notebook' })).toBe(true);
  });
});
