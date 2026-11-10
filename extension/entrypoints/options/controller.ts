import type { Settings, OwnedItem } from '../../src/shared/types';
import { DEFAULT_PURPOSE, LABELS, type Category, type ItemType, type Purpose } from '../../src/shared/lists';
import { isOwnedItem, isSettings } from '../../src/shared/storage-validation';
export interface OptionsClient {
  getSettings(): Promise<Settings>;
  setConsent(value: boolean): Promise<void>;
  getItems(): Promise<OwnedItem[]>;
  loadSampleItems(): Promise<number>;
  addItem(item: OwnedItem): Promise<void>;
  deleteItem(id: string): Promise<void>;
  deleteAllUnhaulData(): Promise<void>;
}
/** What the quick-add form collects. Blank purpose uses the item type's default. */
export const label = (id: Category | ItemType | Purpose): string => LABELS[id] ?? id;
export interface QuickAddInput {
  name: string;
  category: Category;
  itemType: ItemType;
  purpose?: Purpose | '';
  notes?: string;
}
export function buildManualItem(input: QuickAddInput, id: string, now: number): OwnedItem {
  const notes = input.notes?.trim();
  const item: OwnedItem = {
    id, name: input.name.trim(), category: input.category, itemType: input.itemType,
    purpose: input.purpose || DEFAULT_PURPOSE[input.itemType], source: 'manual', createdAt: now,
  };
  if (notes) item.notes = notes;
  if (!isOwnedItem(item)) throw new Error('Enter a name and pick an item type that belongs to the category.');
  return item;
}
export interface OptionsState {
  screen: 'loading' | 'error' | 'consent' | 'items';
  busy: boolean;
  items: OwnedItem[];
  status: string;
  error?: string;
}
export function createOptionsController(client: OptionsClient, render: (state: OptionsState) => void) {
  let state: OptionsState = { screen: 'loading', busy: true, items: [], status: 'Loading your settings…' };
  let revision = 0;
  const latestState = (): OptionsState => state;
  const show = (next: OptionsState) => { state = next; render(next); };
  const message = (error: unknown) => error instanceof Error ? error.message : 'Unhaul could not complete this action. Please retry.';
  async function refresh(status = ''): Promise<void> {
    const current = ++revision;
    show({ screen: 'loading', busy: true, items: [], status: 'Loading your settings…' });
    try {
      const settings = await client.getSettings();
      if (current !== revision) return;
      if (!isSettings(settings)) throw new Error('Invalid settings received. Please retry.');
      if (!settings.consentGiven) {
        show({ screen: 'consent', busy: false, items: [], status });
        return;
      }
      const items = await client.getItems();
      if (current === revision) show({ screen: 'items', busy: false, items, status });
    } catch (error) {
      if (current === revision) show({ screen: 'error', busy: false, items: [], status: '', error: message(error) });
    }
  }
  async function agree(): Promise<void> {
    if (state.screen !== 'consent' || state.busy) return;
    const current = ++revision;
    show({ ...state, busy: true, status: 'Saving your choice…', error: undefined });
    try {
      await client.setConsent(true);
      if (current === revision) await refresh('Unhaul enabled.');
    } catch (error) {
      if (current === revision) show({ screen: 'consent', busy: false, items: [], status: '', error: message(error) });
    }
  }
  function notNow(): void {
    if (state.screen !== 'consent' || state.busy) return;
    ++revision;
    show({ screen: 'consent', busy: false, items: [], status: 'Unhaul remains disabled. You can agree whenever you are ready.' });
  }
  async function loadSamples(): Promise<void> {
    if (state.screen !== 'items' || state.busy) return;
    const current = ++revision;
    show({ ...state, busy: true, status: 'Loading sample items…', error: undefined });
    try {
      const count = await client.loadSampleItems();
      if (current === revision) await refresh(count ? `Added ${count} sample items.` : 'Sample items are already loaded.');
    } catch (error) {
      if (current === revision) show({ ...state, busy: false, status: '', error: message(error) });
    }
  }
  async function addItem(input: QuickAddInput): Promise<boolean> {
    if (state.screen !== 'items' || state.busy) return false;
    let item: OwnedItem;
    try { item = buildManualItem(input, crypto.randomUUID(), Date.now()); }
    catch (error) { show({ ...state, status: '', error: message(error) }); return false; }
    const current = ++revision;
    show({ ...state, busy: true, status: 'Adding item…', error: undefined });
    try {
      await client.addItem(item);
      if (current === revision) await refresh(`Added ${item.name}.`);
      return true;
    } catch (error) {
      if (current === revision) show({ ...state, busy: false, status: '', error: message(error) });
      return false;
    }
  }
  async function deleteItem(id: string): Promise<void> {
    if (state.screen !== 'items' || state.busy) return;
    const target = state.items.find(item => item.id === id);
    const current = ++revision;
    show({ ...state, busy: true, status: 'Deleting item…', error: undefined });
    try {
      await client.deleteItem(id);
      if (current === revision) await refresh(target ? `Deleted ${target.name}.` : 'Item deleted.');
    } catch (error) {
      if (current === revision) show({ ...state, busy: false, status: '', error: message(error) });
    }
  }
  async function turnOff(): Promise<void> {
    if (state.screen !== 'items' || state.busy) return;
    const current = ++revision;
    show({ ...state, busy: true, status: 'Turning off Unhaul…', error: undefined });
    try {
      await client.setConsent(false);
      if (current === revision || latestState().screen === 'consent') {
        ++revision;
        show({ screen: 'consent', busy: false, items: [], status: 'Unhaul is off. Your items are kept. Agree again to turn it back on.' });
      }
    } catch (error) {
      if (current === revision) show({ ...state, busy: false, status: '', error: message(error) });
    }
  }
  async function deleteData(): Promise<void> {
    if (state.screen !== 'items' || state.busy) return;
    const current = ++revision;
    show({ ...state, busy: true, status: 'Deleting Unhaul data…', error: undefined });
    try {
      await client.deleteAllUnhaulData();
      // A storage-change notification may already have returned this view to consent.
      if (current === revision || latestState().screen === 'consent') {
        ++revision;
        show({ screen: 'consent', busy: false, items: [], status: 'All Unhaul data deleted. Please agree before using Unhaul again.' });
      }
    } catch (error) {
      if (current === revision) show({ ...state, busy: false, status: '', error: message(error) });
    }
  }
  function settingsChanged(value: unknown): void {
    if (value === undefined || (isSettings(value) && !value.consentGiven)) {
      ++revision;
      show({ screen: 'consent', busy: false, items: [], status: 'Unhaul is disabled. Please agree before continuing.' });
    } else if (!(state.screen === 'consent' && state.busy && isSettings(value))) {
      // Own successful agreement is revealed only after its persistence promise resolves.
      void refresh();
    }
  }
  return { refresh, agree, notNow, loadSamples, addItem, deleteItem, turnOff, deleteData, settingsChanged };
}
