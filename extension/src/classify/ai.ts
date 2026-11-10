import type { Classification, Product } from '../shared/types';
// B: connect a deployed proxy, enforce timeout, validate output and cache results.
// Returning null tells the caller to use keywords; no AI request is made yet.
export async function classifyAI(_product: Product): Promise<Classification | null> {
  return null;
}
