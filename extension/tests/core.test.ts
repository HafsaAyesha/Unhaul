import { describe, expect, it } from 'vitest';
import { classifyKeywords } from '../src/classify/keywords';
import { isClassification } from '../src/classify/validate';
import { matchItems } from '../src/match/match';
import { EXAMPLE_CLASSIFICATION, EXAMPLE_OWNED, EXAMPLE_PRODUCT_NO_PRICE, EXAMPLE_SAVED } from '../src/shared/examples';
import { WAITS } from '../src/shared/lists';
import { sampleItems } from '../src/storage/sample-items';

describe('classification and matching contracts', () => {
  it('finds a journal while excluding other categories', () => {
    expect(matchItems(classifyKeywords('A5 dotted journal'), sampleItems).map(item => item.id)).toEqual(['sample-journal']);
  });
  it('does not match unknown products', () => {
    const result = classifyKeywords('Mystery item');
    expect(result).toMatchObject({ category: 'other', itemType: 'other', confidence: 0, source: 'keywords' });
    expect(matchItems(result, sampleItems)).toEqual([]);
  });
  it('matches whole words only', () => {
    expect(classifyKeywords('Open box gift set').itemType).not.toBe('pen');
    expect(classifyKeywords('Laptop sleeve').itemType).not.toBe('top');
    expect(classifyKeywords('Gel pen pack of 10').itemType).toBe('pen');
  });
  it('prefers longer phrases', () => {
    expect(classifyKeywords('20000mAh Power Bank').itemType).toBe('power_bank');
    expect(classifyKeywords('Smartwatch with heart rate').itemType).toBe('smartwatch');
    expect(classifyKeywords('TWS Bluetooth 5.3 Earphones Pro')).toMatchObject({ category: 'electronics', itemType: 'headphones', purpose: 'personal_audio' });
  });
  it('accepts only values from the fixed lists', () => {
    expect(isClassification(EXAMPLE_CLASSIFICATION)).toBe(true);
    expect(isClassification(classifyKeywords('A5 dotted journal'))).toBe(true);
    expect(isClassification({ ...EXAMPLE_CLASSIFICATION, category: 'invented' })).toBe(false);
    expect(isClassification({ ...EXAMPLE_CLASSIFICATION, itemType: 'headphones' })).toBe(false); // wrong category
    expect(isClassification({ ...EXAMPLE_CLASSIFICATION, purpose: 'personal audio' })).toBe(false);
    expect(isClassification({ ...EXAMPLE_CLASSIFICATION, confidence: 2 })).toBe(false);
    expect(isClassification({ category: 'stationery', itemType: 'notebook' })).toBe(false);
  });
  it('keeps the example records consistent with the contracts', () => {
    expect(EXAMPLE_PRODUCT_NO_PRICE.price).toBeNull();
    expect(EXAMPLE_SAVED.deadline - EXAMPLE_SAVED.savedAt).toBe(WAITS[EXAMPLE_SAVED.wait]);
    expect(matchItems(EXAMPLE_CLASSIFICATION, [EXAMPLE_OWNED])).toEqual([EXAMPLE_OWNED]);
  });
});
