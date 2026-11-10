<<<<<<< HEAD
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
=======
import { storageClient } from '../../src/storage/client';
import { computeInsights, isReady } from '../../src/storage/insights';
import type { OwnedItem, SavedItem } from '../../src/shared/types';

const TYPES = ['suit', 'shirt', 'trousers', 'jeans', 'jacket', 'dress', 'shoes', 'kurta', 'belt'];
const COLORS = ['green', 'navy', 'black', 'white', 'beige', 'blue', 'red'];

function escapeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}
function timeLeft(item: SavedItem, now: number): string {
  if (isReady(item, now)) return 'Ready';
  const deadline = item.deadline === undefined ? item.reconsiderAt : item.deadline;
  if (deadline == null) return 'No timer';
  const ms = deadline - now;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${m}m left`;
}

export async function mountOptions(): Promise<void> {
  const consentGate = document.querySelector<HTMLElement>('#consent-gate')!;
  const app = document.querySelector<HTMLElement>('#app')!;
  const status = document.querySelector<HTMLParagraphElement>('#status')!;
  const itemsEl = document.querySelector<HTMLUListElement>('#items')!;
  const savedEl = document.querySelector<HTMLUListElement>('#saved')!;
  const typesEl = document.querySelector<HTMLElement>('#types')!;
  const colorsEl = document.querySelector<HTMLElement>('#colors')!;
  const insightsEl = document.querySelector<HTMLParagraphElement>('#insights')!;
  const insightsSection = document.querySelector<HTMLElement>('#insights-section')!;
  const budgetEl = document.querySelector<HTMLInputElement>('#budget')!;
  const nameEl = document.querySelector<HTMLInputElement>('#item-name')!;
  let type = TYPES[0];
  let color = COLORS[0];
  let busy = false;

  function choiceRow(host: HTMLElement, values: string[], current: () => string, set: (v: string) => void) {
    host.replaceChildren(...values.map(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = value;
      button.setAttribute('aria-pressed', String(current() === value));
      button.addEventListener('click', () => { set(value); renderChoices(); });
      return button;
    }));
  }
  function renderChoices() {
    choiceRow(typesEl, TYPES, () => type, value => { type = value; });
    choiceRow(colorsEl, COLORS, () => color, value => { color = value; });
  }
  function setStatus(text: string, alert = false) {
    status.setAttribute('role', alert ? 'alert' : 'status');
    status.textContent = text;
  }
  async function perform(action: () => Promise<string>): Promise<void> {
    if (busy) return;
    busy = true;
    try { setStatus(await action()); } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unhaul could not complete this action. Please retry.', true);
    } finally { busy = false; }
  }

  async function render(): Promise<void> {
    const settings = await storageClient.getSettings();
    const consented = settings.consentGiven;
    consentGate.hidden = consented;
    app.hidden = !consented;
    if (!consented) { itemsEl.replaceChildren(); savedEl.replaceChildren(); return; }
    if (settings.monthlyBudget != null) budgetEl.value = String(settings.monthlyBudget);
    else budgetEl.value = '';
    const items = await storageClient.getItems();
    itemsEl.replaceChildren(...items.map(item => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${item.name} — ${item.itemType}${item.colorFamily ? ` (${item.colorFamily})` : ''}`;
      const del = document.createElement('button');
      del.type = 'button'; del.textContent = 'Delete';
      del.addEventListener('click', () => void perform(async () => {
        await storageClient.deleteItem(item.id); await render(); return 'Item deleted.';
      }));
      li.append(label, del);
      return li;
    }));
    const saved = await storageClient.getSavedItems();
    const now = Date.now();
    savedEl.replaceChildren(...saved.map(item => {
      const li = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = `${item.product.title} — ${item.status === 'waiting' ? timeLeft(item, now) : item.status}`;
      li.append(title);
      const href = escapeUrl(item.product.url);
      if (href) {
        const link = document.createElement('a');
        link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = 'Open';
        li.append(link);
      }
      const imgSrc = escapeUrl(item.product.image);
      if (imgSrc) {
        const img = document.createElement('img');
        img.src = imgSrc; img.alt = ''; img.width = 48; img.height = 48;
        li.append(img);
      }
      if (item.status === 'waiting') {
        for (const [label, status] of [['Skip', 'skipped'], ['Purchased', 'purchased']] as const) {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = label;
          button.addEventListener('click', () => void perform(async () => {
            await storageClient.setSavedStatus(item.id, status);
            if (status === 'purchased' && window.confirm('Add this to your wardrobe?')) {
              const owned: OwnedItem = {
                id: `owned-${item.id}`, name: item.product.title, category: 'other', itemType: 'other',
                notes: item.product.title,
              };
              await storageClient.addItem(owned);
            }
            await render();
            return status === 'skipped' ? 'Marked skip.' : 'Marked purchased.';
          }));
          li.append(button);
        }
      }
      return li;
    }));
    const insights = computeInsights(saved, settings.monthlyBudget ?? null);
    if (insights.hidden) insightsSection.hidden = true;
    else {
      insightsSection.hidden = false;
      const shareHint = saved.find(item => item.status === 'waiting' && item.product.price != null);
      const share = shareHint ? insights.budgetShare(shareHint.product.price) : null;
      insightsEl.textContent = [
        `Saved: ${insights.itemsSaved}`,
        `Skipped: ${insights.skipped}`,
        `Potential spend avoided: ${insights.potentialAvoided}`,
        `Spend this month: ${insights.spendThisMonth}`,
        share == null ? '' : `Budget share (open item): ${share === Number.POSITIVE_INFINITY ? 'over' : share.toFixed(2)}`,
        insights.overBudget ? 'Over budget' : '',
      ].filter(Boolean).join(' · ');
    }
  }

  document.querySelector('#agree')!.addEventListener('click', () => void perform(async () => {
    await storageClient.setConsent(true); await render(); return 'Consent saved.';
  }));
  document.querySelector('#load-sample')!.addEventListener('click', () => void perform(async () => {
    const count = await storageClient.loadSampleItems(); await render();
    return count ? `Added ${count} sample items.` : 'Sample items are already loaded.';
  }));
  document.querySelector('#quick-add')!.addEventListener('click', () => void perform(async () => {
    const name = nameEl.value.trim() || `${color} ${type}`;
    await storageClient.addItem({
      id: `manual-${Date.now()}`, name, category: 'clothing-accessories', itemType: type, purpose: 'wearing', colorFamily: color,
    });
    nameEl.value = '';
    await render();
    return 'Added to wardrobe.';
  }));
  budgetEl.addEventListener('change', () => void perform(async () => {
    const raw = budgetEl.value.trim();
    await storageClient.setMonthlyBudget(raw === '' ? null : Number(raw));
    await render();
    return 'Budget updated.';
  }));
  document.querySelector('#delete-data')!.addEventListener('click', () => void perform(async () => {
    await storageClient.deleteAllUnhaulData();
    await render();
    return 'All Unhaul data deleted.';
  }));
  renderChoices();
  await storageClient.initializeStorage();
  await render();
>>>>>>> 38a0ce5 (cleaning)
}
