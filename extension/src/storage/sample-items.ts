import type { OwnedItem } from '../shared/types';
<<<<<<< HEAD

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
=======
const c = 'clothing-accessories' as const;
export const sampleItems: OwnedItem[] = [
  { id: 'sample-journal', name: 'Dotted journal', category: 'stationery', itemType: 'notebook', purpose: 'writing' },
  { id: 'sample-vase', name: 'Ceramic vase', category: 'home-decor', itemType: 'vase', purpose: 'decoration' },
  { id: 'sample-headphones', name: 'Wireless headphones', category: 'electronics', itemType: 'headphones', purpose: 'personal audio' },
  { id: 'sample-puzzle', name: 'Jigsaw puzzle', category: 'toys-games', itemType: 'puzzle', purpose: 'play' },
  { id: 'sample-green-suit-1', name: 'Green 3-piece suit', category: c, itemType: 'suit', purpose: 'wearing', colorFamily: 'green' },
  { id: 'sample-green-suit-2', name: 'Forest green 3-piece suit', category: c, itemType: 'suit', purpose: 'wearing', colorFamily: 'green' },
  { id: 'sample-green-suit-3', name: 'Olive 3-piece suit', category: c, itemType: 'suit', purpose: 'wearing', colorFamily: 'green' },
  { id: 'sample-navy-suit', name: 'Navy suit', category: c, itemType: 'suit', purpose: 'wearing', colorFamily: 'navy' },
  { id: 'sample-white-shirt', name: 'White dress shirt', category: c, itemType: 'shirt', purpose: 'wearing', colorFamily: 'white' },
  { id: 'sample-blue-jeans', name: 'Blue jeans', category: c, itemType: 'jeans', purpose: 'wearing', colorFamily: 'blue' },
  { id: 'sample-black-trousers', name: 'Black trousers', category: c, itemType: 'trousers', purpose: 'wearing', colorFamily: 'black' },
  { id: 'sample-beige-blazer', name: 'Beige blazer', category: c, itemType: 'jacket', purpose: 'wearing', colorFamily: 'beige' },
  { id: 'sample-red-dress', name: 'Red midi dress', category: c, itemType: 'dress', purpose: 'wearing', colorFamily: 'red' },
  { id: 'sample-white-sneakers', name: 'White sneakers', category: c, itemType: 'shoes', purpose: 'wearing', colorFamily: 'white' },
  { id: 'sample-green-kurta', name: 'Green kurta', category: c, itemType: 'kurta', purpose: 'wearing', colorFamily: 'green' },
  { id: 'sample-black-belt', name: 'Black belt', category: c, itemType: 'belt', purpose: 'wearing', colorFamily: 'black' },
>>>>>>> 38a0ce5 (cleaning)
];
