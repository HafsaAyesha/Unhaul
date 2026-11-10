// src/shared/lists.ts
// Fixed lists. Lowercase IDs with underscores in code. Display names live in LABELS.

export const CATEGORIES = [
  'stationery',
  'home_decor',
  'toys_games',
  'electronics',
  'clothing_accessories',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const ITEM_TYPES = {
  stationery: [
    'notebook', 'pen', 'pencil', 'planner', 'sticky_notes',
    'art_supplies', 'desk_organizer', 'pouch', 'paper_cutter',
  ],
  home_decor: [
    'vase', 'candle', 'frame', 'wall_art', 'lamp',
    'cushion', 'plant_pot', 'storage_box', 'mug',
  ],
  toys_games: [
    'soft_toy', 'board_game', 'puzzle', 'building_set',
    'doll', 'action_figure', 'outdoor_toy',
  ],
  electronics: [
    'headphones', 'charger', 'cable', 'power_bank',
    'speaker', 'smartwatch', 'phone_case', 'mouse_keyboard',
  ],
  clothing_accessories: [
    'top', 'bottoms', 'dress_suit', 'outerwear',
    'shoes', 'bag', 'jewellery', 'watch', 'cap',
  ],
  other: ['other'],
} as const satisfies Record<Category, readonly string[]>;
export type ItemType = (typeof ITEM_TYPES)[Category][number];

export const PURPOSES = [
  'writing', 'organizing', 'decoration', 'lighting', 'personal_audio',
  'charging', 'play', 'wearing', 'carrying', 'other',
] as const;
export type Purpose = (typeof PURPOSES)[number];

// Each item type's usual purpose. TypeScript errors if any item type is missing.
export const DEFAULT_PURPOSE: Record<ItemType, Purpose> = {
  notebook: 'writing',
  pen: 'writing',
  pencil: 'writing',
  planner: 'organizing',
  sticky_notes: 'organizing',
  art_supplies: 'other',
  desk_organizer: 'organizing',
  pouch: 'carrying',
  paper_cutter: 'other',
  vase: 'decoration',
  candle: 'decoration',
  frame: 'decoration',
  wall_art: 'decoration',
  lamp: 'lighting',
  cushion: 'decoration',
  plant_pot: 'decoration',
  storage_box: 'organizing',
  mug: 'other',
  soft_toy: 'play',
  board_game: 'play',
  puzzle: 'play',
  building_set: 'play',
  doll: 'play',
  action_figure: 'play',
  outdoor_toy: 'play',
  headphones: 'personal_audio',
  charger: 'charging',
  cable: 'charging',
  power_bank: 'charging',
  speaker: 'personal_audio',
  smartwatch: 'wearing',
  phone_case: 'other',
  mouse_keyboard: 'other',
  top: 'wearing',
  bottoms: 'wearing',
  dress_suit: 'wearing',
  outerwear: 'wearing',
  shoes: 'wearing',
  bag: 'carrying',
  cap: 'wearing',
  jewellery: 'wearing',
  watch: 'wearing',
  other: 'other',
};

// Words in titles that mean an item type. Lowercase. Used by the keyword fallback.
// Decision: "notepad" maps to notebook (the fridge notepad case). Change here if the team disagrees.
export const SYNONYMS: Record<string, ItemType> = {
  // stationery
  notebook: 'notebook', journal: 'notebook', diary: 'notebook', copy: 'notebook',
  notepad: 'notebook', sketchbook: 'notebook',
  pen: 'pen', ballpoint: 'pen', 'gel pen': 'pen', marker: 'pen', highlighter: 'pen',
  pencil: 'pencil',
  planner: 'planner',
  'sticky note': 'sticky_notes', 'sticky notes': 'sticky_notes',
  'paper cutter': 'paper_cutter', cutter: 'paper_cutter',
  pouch: 'pouch',
  // home
  mug: 'mug', 'coffee mug': 'mug', 'ceramic mug': 'mug',
  vase: 'vase', candle: 'candle', frame: 'frame',
  lamp: 'lamp', cushion: 'cushion',
  'flower pot': 'plant_pot', planter: 'plant_pot',
  // toys
  plushie: 'soft_toy', 'stuffed toy': 'soft_toy', teddy: 'soft_toy',
  puzzle: 'puzzle', doll: 'doll',
  // electronics
  headphones: 'headphones', earbuds: 'headphones', earphones: 'headphones',
  tws: 'headphones', headset: 'headphones',
  charger: 'charger', adapter: 'charger', cable: 'cable',
  'power bank': 'power_bank', speaker: 'speaker',
  smartwatch: 'smartwatch', 'phone case': 'phone_case',
  // clothing
  suit: 'dress_suit', unstitched: 'dress_suit', lawn: 'dress_suit',
  shirt: 'top', kurta: 'top', kameez: 'top', top: 'top',
  trouser: 'bottoms', trousers: 'bottoms', pants: 'bottoms', jeans: 'bottoms',
  jacket: 'outerwear', coat: 'outerwear', hoodie: 'outerwear', shawl: 'outerwear',
  shoes: 'shoes', sneakers: 'shoes', sandals: 'shoes', heels: 'shoes',
  bag: 'bag', handbag: 'bag', backpack: 'bag', tote: 'bag',
  necklace: 'jewellery', earrings: 'jewellery', bracelet: 'jewellery',
  watch: 'watch',
};

// Display names for the UI. TypeScript errors if any entry is missing.
export const LABELS: Record<Category | ItemType | Purpose, string> = {
  // categories
  stationery: 'Stationery',
  home_decor: 'Home and decor',
  toys_games: 'Toys and games',
  electronics: 'Electronics',
  clothing_accessories: 'Clothing and accessories',
  // item types
  notebook: 'Notebook',
  pen: 'Pen',
  pencil: 'Pencil',
  planner: 'Planner',
  sticky_notes: 'Sticky notes',
  art_supplies: 'Art supplies',
  desk_organizer: 'Desk organizer',
  pouch: 'Pouch',
  paper_cutter: 'Paper cutter',
  vase: 'Vase',
  candle: 'Candle',
  frame: 'Frame',
  wall_art: 'Wall art',
  lamp: 'Lamp',
  cushion: 'Cushion',
  plant_pot: 'Plant pot',
  storage_box: 'Storage box',
  mug: 'Mug',
  soft_toy: 'Soft toy',
  board_game: 'Board game',
  puzzle: 'Puzzle',
  building_set: 'Building set',
  doll: 'Doll',
  action_figure: 'Action figure',
  outdoor_toy: 'Outdoor toy',
  headphones: 'Headphones',
  charger: 'Charger',
  cable: 'Cable',
  power_bank: 'Power bank',
  speaker: 'Speaker',
  smartwatch: 'Smartwatch',
  phone_case: 'Phone case',
  mouse_keyboard: 'Mouse or keyboard',
  top: 'Top',
  bottoms: 'Bottoms',
  dress_suit: 'Suit or dress',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bag: 'Bag',
  cap: 'Cap',
  jewellery: 'Jewellery',
  watch: 'Watch',
  // purposes
  writing: 'Writing',
  organizing: 'Organizing',
  decoration: 'Decoration',
  lighting: 'Lighting',
  personal_audio: 'Personal audio',
  charging: 'Charging',
  play: 'Play',
  wearing: 'Wearing',
  carrying: 'Carrying',
  // shared by category, item type and purpose
  other: 'Other',
};

export const WAITS = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
} as const;
export type WaitKey = keyof typeof WAITS;

export const WAIT_LABELS: Record<WaitKey, string> = {
  '24h': '24 hours',
  '3d': '3 days',
  '7d': '7 days',
};

// Helper: all item types as a flat list (for validating AI replies with zod).
export const ALL_ITEM_TYPES = Array.from(
  new Set(
    (Object.values(ITEM_TYPES) as readonly (readonly string[])[]).flatMap((x) => [...x]),
  ),
) as ItemType[];
