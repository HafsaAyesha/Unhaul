import { expect, it } from 'vitest';
import { choosePrompt } from '../src/match/prompts';
it('prioritizes owned matches, verified discounts, recorded repeat visits, then the generic question', () => {
  const sale = { price: 10, wasPrice: 20, currency: 'PKR' };
  expect(choosePrompt(1, sale, true)).toBe('What would this add beyond what you already own?');
  expect(choosePrompt(0, sale, true)).toBe('Would you still want this at full price?');
  expect(choosePrompt(0, { ...sale, wasPrice: 5 }, true)).toBe('What need would this purchase meet?');
  expect(choosePrompt(0, { ...sale, price: null })).toBe('Would you still want this after three days?');
  expect(choosePrompt(0, { ...sale, currency: null })).toBe('Would you still want this after three days?');
});
