import { browser } from 'wxt/browser';
import type { OwnedItem } from '../shared/types';
export const repo = {
  async getItems(): Promise<OwnedItem[]> {
    const data = await browser.storage.local.get('items');
    return (data.items as OwnedItem[] | undefined) ?? [];
  },
  async setItems(items: OwnedItem[]): Promise<void> {
    await browser.storage.local.set({ items });
  },
};
// C: add schema validation/migrations, saved items, visits and settings.
