import { CATEGORIES } from '../shared/lists';
import type { Classification } from '../shared/types';
export function isClassification(value: unknown): value is Classification {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return CATEGORIES.some(category => category === data.category)
    && typeof data.itemType === 'string' && data.itemType.trim().length > 0
    && (data.purpose === undefined || typeof data.purpose === 'string');
}
