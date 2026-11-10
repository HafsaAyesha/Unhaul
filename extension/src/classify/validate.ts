import { isClassification as validate } from '../shared/storage-validation';
import { record } from '../shared/storage-validation';
import type { Classification } from '../shared/types';
export const isClassification = validate;
/** Model output never controls source or timestamps. Reject rather than invent invalid taxonomy. */
export function parseAIClassification(value: unknown, now = Date.now()): Classification | null {
  if (!record(value)) return null;
  const result = { category: value.category, itemType: value.itemType, purpose: value.purpose,
    confidence: value.confidence, source: 'ai', classifiedAt: now };
  if (!validate(result)) return null;
  if (result.confidence < 0.5) return { category: 'other', itemType: 'other', purpose: 'other', confidence: result.confidence, source: 'ai', classifiedAt: now };
  return result;
}
