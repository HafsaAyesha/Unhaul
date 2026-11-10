import { LABELS } from '../shared/lists';
import type { Classification, Match, OwnedItem } from '../shared/types';
export interface MatchSummary { matches: Match[]; totalMatches: number; }
/** Broad category/purpose similarity alone is weak evidence and is not returned. */
export function findMatches(product: Classification, items: OwnedItem[]): MatchSummary {
  if (product.itemType === 'other' || product.category === 'other' || product.confidence < 0.5) return { matches: [], totalMatches: 0 };
  const candidates = items.filter(item => item.category === product.category && item.itemType === product.itemType
    && !(item.purpose && item.purpose !== 'other' && product.purpose !== 'other' && item.purpose !== product.purpose));
  const ranked = candidates.map((item, index) => ({ item, index, samePurpose: Boolean(item.purpose && item.purpose !== 'other' && item.purpose === product.purpose) }))
    .sort((a, b) => Number(b.samePurpose) - Number(a.samePurpose) || a.index - b.index);
  return {
    totalMatches: ranked.length,
    matches: ranked.slice(0, 3).map(({ item, samePurpose }) => ({ item, strength: 'strong',
      reason: `Same type: ${LABELS[item.itemType]}${samePurpose ? `; same purpose: ${LABELS[product.purpose]}` : ''}` })),
  };
}
/** Compatibility helper for existing callers; capped at three relevant examples. */
export function matchItems(product: Classification, items: OwnedItem[]): OwnedItem[] {
  return findMatches(product, items).matches.map(match => match.item);
}
