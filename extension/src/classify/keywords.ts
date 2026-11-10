import { DEFAULT_PURPOSE, ITEM_TYPES, SYNONYMS, type Category, type ItemType } from '../shared/lists';
import type { Classification } from '../shared/types';

const CATEGORY_OF = new Map<ItemType, Category>(
  (Object.entries(ITEM_TYPES) as [Category, readonly ItemType[]][])
    .flatMap(([category, types]) => types.map(type => [type, category] as [ItemType, Category])),
);

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Item type names ("sticky_notes" -> "sticky notes") plus synonyms.
// Longest phrases first, so "power bank" wins over "bank" and "smartwatch" over "watch".
const PHRASES: [RegExp, ItemType][] = (() => {
  const map = new Map<string, ItemType>();
  for (const type of CATEGORY_OF.keys()) if (type !== 'other') map.set(type.replace(/_/g, ' '), type);
  for (const [word, type] of Object.entries(SYNONYMS)) map.set(word.toLowerCase(), type);
  return [...map.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    // Whole words only: "pen" never matches "open", "top" never matches "laptop".
    .map(([phrase, type]) => [new RegExp(`(^|[^a-z0-9])${escape(phrase)}($|[^a-z0-9])`), type]);
})();

/** Keyword fallback. Unknown products become Other with zero confidence. */
export function classifyKeywords(title: string, categoryText = ''): Classification {
  // Specific title evidence takes precedence over broad breadcrumb/category metadata.
  const hit = PHRASES.find(([pattern]) => pattern.test(title.toLowerCase()))
    ?? PHRASES.find(([pattern]) => pattern.test(categoryText.toLowerCase()));
  const itemType: ItemType = hit ? hit[1] : 'other';
  return {
    category: CATEGORY_OF.get(itemType) ?? 'other',
    itemType,
    purpose: DEFAULT_PURPOSE[itemType],
    confidence: hit ? 0.6 : 0,
    source: 'keywords',
    classifiedAt: Date.now(),
  };
}
