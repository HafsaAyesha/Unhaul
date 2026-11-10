import type { Product, SavedItem } from './types';
export type Message =
  | { type: 'PRODUCT_VIEWED'; product: Product }
  | { type: 'GET_PRODUCT_ANALYSIS'; product: Product }
  | { type: 'SAVE_FOR_LATER'; product: Product; waitDays: 1 | 3 | 7 }
  | { type: 'GET_SAVED_ITEMS' }
  | { type: 'UPDATE_SAVED_STATUS'; id: string; status: SavedItem['status'] }
  | { type: 'DELETE_ALL_DATA' };
// Add runtime validation before accepting messages from content scripts.
