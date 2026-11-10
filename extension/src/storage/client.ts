/** UI/content transport only; never imports the background repository. */
import { browser } from 'wxt/browser';
import { isStorageResponse, type StorageArguments, type StorageOperation, type StorageResults } from '../shared/storage-messages';
import type { OwnedItem, SavedItem, VisitRecord, ClassificationCache } from '../shared/types';
async function call<K extends StorageOperation>(operation: K, args: StorageArguments[K]): Promise<StorageResults[K]> {
  const reply: unknown = await browser.runtime.sendMessage({ type: 'STORAGE', operation, args });
  if (!isStorageResponse(operation, reply)) throw new Error('Invalid response from Unhaul storage.');
  if (!reply.ok) throw new Error(reply.error.message);
  return reply.value;
}
export const storageClient = {
  initializeStorage: async (): Promise<void> => { await call('initializeStorage', []); },
  getSettings: () => call('getSettings', []),
  setConsent: async (value: boolean): Promise<void> => { await call('setConsent', [value]); },
  getItems: () => call('getItems', []),
  addItem: async (item: OwnedItem): Promise<void> => { await call('addItem', [item]); },
  deleteItem: async (id: string): Promise<void> => { await call('deleteItem', [id]); },
  loadSampleItems: () => call('loadSampleItems', []),
  getSavedItems: () => call('getSavedItems', []),
  setSavedItems: async (records: SavedItem[]): Promise<void> => { await call('setSavedItems', [records]); },
  getVisits: () => call('getVisits', []),
  setVisits: async (records: VisitRecord[]): Promise<void> => { await call('setVisits', [records]); },
  getClassificationCache: () => call('getClassificationCache', []),
  setClassificationCache: async (cache: ClassificationCache): Promise<void> => { await call('setClassificationCache', [cache]); },
  deleteAllUnhaulData: async (): Promise<void> => { await call('deleteAllUnhaulData', []); },
};
