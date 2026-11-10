import type { Settings, OwnedItem } from '../../src/shared/types';
import { isSettings } from '../../src/shared/storage-validation';
export interface OptionsClient {
  getSettings(): Promise<Settings>;
  setConsent(value: boolean): Promise<void>;
  getItems(): Promise<OwnedItem[]>;
  loadSampleItems(): Promise<number>;
  deleteAllUnhaulData(): Promise<void>;
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
  return { refresh, agree, notNow, loadSamples, deleteData, settingsChanged };
}
