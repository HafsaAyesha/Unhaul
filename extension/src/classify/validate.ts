import { CATEGORIES, ITEM_TYPES, PURPOSES, type Category } from '../shared/lists';
import type { Classification } from '../shared/types';

/** True only when every value comes from the fixed lists (context.md section 7). */
export function isClassification(value: unknown): value is Classification {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (!CATEGORIES.some(category => category === data.category)) return false;
  const types = ITEM_TYPES[data.category as Category] as readonly string[];
  return typeof data.itemType === 'string' && types.includes(data.itemType)
    && PURPOSES.some(purpose => purpose === data.purpose)
    && typeof data.confidence === 'number' && data.confidence >= 0 && data.confidence <= 1
    && (data.source === 'ai' || data.source === 'keywords')
    && typeof data.classifiedAt === 'number';
}
