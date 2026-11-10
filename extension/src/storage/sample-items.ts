import type { OwnedItem } from '../shared/types';
// Made-up sample items. Fixed IDs and createdAt so loading twice never duplicates.
const CREATED = 1760000000000;
export const sampleItems: OwnedItem[] = [
  { id: 'sample-journal', name: 'Dotted journal', category: 'stationery', itemType: 'notebook', purpose: 'writing', source: 'sample', createdAt: CREATED },
  { id: 'sample-vase', name: 'Ceramic vase', category: 'home_decor', itemType: 'vase', purpose: 'decoration', source: 'sample', createdAt: CREATED },
  { id: 'sample-headphones', name: 'Wireless headphones', category: 'electronics', itemType: 'headphones', purpose: 'personal_audio', source: 'sample', createdAt: CREATED },
  { id: 'sample-puzzle', name: 'Jigsaw puzzle', category: 'toys_games', itemType: 'puzzle', purpose: 'play', source: 'sample', createdAt: CREATED },
];
