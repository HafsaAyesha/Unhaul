import type { OwnedItem } from '../shared/types';

// Fictional demo records, not purchase history. Fixed IDs/timestamps make loading repeatable.
// Category/type IDs come from shared/lists.ts; sample-loading behavior is unchanged.
const CREATED = 1760000000000;
export const sampleItems: OwnedItem[] = [
  { id: 'sample-01', name: 'Dotted writing journal', category: 'stationery', itemType: 'notebook', purpose: 'writing', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-02', name: 'Pastel gel pen set', category: 'stationery', itemType: 'pen', purpose: 'writing', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-03', name: 'Small ceramic vase', category: 'home_decor', itemType: 'vase', purpose: 'decoration', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-04', name: 'Star-shaped decorative lamp', category: 'home_decor', itemType: 'lamp', purpose: 'lighting', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-05', name: 'Mountain landscape jigsaw puzzle', category: 'toys_games', itemType: 'puzzle', purpose: 'play', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-06', name: 'Family adventure board game', category: 'toys_games', itemType: 'board_game', purpose: 'play', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-07', name: 'Wireless over-ear headphones', category: 'electronics', itemType: 'headphones', purpose: 'personal_audio', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-08', name: 'USB-C wall charger', category: 'electronics', itemType: 'charger', purpose: 'charging', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-09', name: 'Canvas everyday backpack', category: 'clothing_accessories', itemType: 'bag', purpose: 'carrying', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
  { id: 'sample-10', name: 'Plain cotton cap', category: 'clothing_accessories', itemType: 'cap', purpose: 'wearing', notes: 'Fictional sample item', source: 'sample', createdAt: CREATED },
];
