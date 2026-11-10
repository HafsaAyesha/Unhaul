import type { Product } from '../shared/types';
/** Priority is explicit; a repeat visit must be recorded, not inferred from page rerenders. */
export function choosePrompt(similarCount: number, product?: Pick<Product, 'price' | 'wasPrice' | 'currency'>, repeatVisit = false): string {
  if (similarCount > 0) return 'What would this add beyond what you already own?';
  if (product && product.currency && product.price !== null && product.wasPrice !== null
    && Number.isFinite(product.price) && product.price >= 0 && Number.isFinite(product.wasPrice) && product.wasPrice > product.price) {
    return 'Would you still want this at full price?';
  }
  return repeatVisit ? 'What need would this purchase meet?' : 'Would you still want this after three days?';
}
