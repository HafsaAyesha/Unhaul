import type { Classification } from '../shared/types';
export function classifyKeywords(title: string): Classification {
  const text = title.toLowerCase();
  if (/\b(journal|notebook)\b/.test(text)) return { category: 'stationery', itemType: 'notebook', purpose: 'writing' };
  if (/\b(headphones|earbuds)\b/.test(text)) return { category: 'electronics', itemType: 'headphones', purpose: 'personal audio' };
  if (/\bvase\b/.test(text)) return { category: 'home-decor', itemType: 'vase', purpose: 'decoration' };
  if (/\bpuzzle\b/.test(text)) return { category: 'toys-games', itemType: 'puzzle', purpose: 'play' };
  return { category: 'other', itemType: 'unknown' };
}
