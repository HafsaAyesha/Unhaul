import { coolingState } from '../../src/shared/cooling';
import type { OwnedItem, SavedItem, Settings } from '../../src/shared/types';
import { formatPrice } from '../../src/ui/price';
import { STORE_DOMAINS } from '../../src/store/stores';

export interface JourneyStep {
  id: 'consent' | 'owned' | 'saved' | 'decision';
  title: string;
  done: boolean;
}

export function journeySteps(settings: Settings, items: OwnedItem[], saved: SavedItem[]): JourneyStep[] {
  return [
    { id: 'consent', title: 'Agree to consent', done: settings.consentGiven },
    { id: 'owned', title: 'Add at least 3 things you own', done: items.length >= 3 },
    { id: 'saved', title: 'Save your first product for later', done: saved.length > 0 },
    { id: 'decision', title: 'Make your first decision', done: saved.some(item => item.status === 'skipped' || item.status === 'purchased') },
  ];
}

export interface HomeSummary {
  waiting: number;
  ready: number;
  skipped: number;
  notSpent: Record<string, number>;
}

export function homeSummary(saved: SavedItem[], now = Date.now()): HomeSummary {
  const summary: HomeSummary = { waiting: 0, ready: 0, skipped: 0, notSpent: {} };
  for (const item of saved) {
    if (item.status === 'skipped') {
      summary.skipped++;
      if (item.product.price !== null && item.product.currency) {
        summary.notSpent[item.product.currency] = (summary.notSpent[item.product.currency] ?? 0) + item.product.price;
      }
    } else if (item.status === 'waiting') {
      try { if (coolingState(item, now).ready) summary.ready++; else summary.waiting++; } catch { summary.waiting++; }
    }
  }
  return summary;
}

interface HomeClient {
  getSettings(): Promise<Settings>;
  getItems(): Promise<OwnedItem[]>;
  getSavedItems(): Promise<SavedItem[]>;
}

function storeName(domain: string): string {
  const names: Record<string, string> = {
    'daraz.pk': 'Daraz', 'bonanzasatrangi.com': 'Bonanza Satrangi', 'crossstitch.pk': 'Cross Stitch',
    'junaidjamshed.com': 'Junaid Jamshed', 'outfitters.com.pk': 'Outfitters', 'zellbury.com': 'Zellbury',
    'stationers.pk': 'Stationers.pk', 'thestationerycompany.pk': 'The Stationery Company',
    'zubaidas.com': 'Zubaida’s', 'rung.com.pk': 'Rung', 'theschoolstore.pk': 'The School Store',
    'saleemibookdepot.com': 'Saleemi Book Depot', 'toycompany.pk': 'Toy Company', 'toynix.pk': 'Toynix',
    'odeez.pk': 'Odeez', 'babybazar.pk': 'Baby Bazar', 'chasevalue.pk': 'Chase Value',
    'designyourown.pk': 'Design Your Own', 'blingspot.pk': 'Blingspot', 'soz.com.pk': 'SOZ',
    'nishatlinen.com': 'Nishat Linen',
  };
  return names[domain] ?? domain;
}

export const SUPPORTED_STORE_NAMES = STORE_DOMAINS.map(storeName);

export function createHome(root: HTMLElement, client: HomeClient, onNavigate: (view: 'items' | 'saved' | 'dashboard') => void, onLoadSamples: () => void) {
  let enabled = false;
  let disposed = false;
  let revision = 0;
  const refresh = async (): Promise<void> => {
    if (!enabled || disposed) return;
    const current = ++revision;
    root.replaceChildren();
    const loading = root.ownerDocument.createElement('p');
    loading.textContent = 'Loading your activity…';
    root.append(loading);
    try {
        const saved = await client.getSavedItems();
      if (!enabled || disposed || current !== revision) return;
        render(saved);
    } catch (failure) {
      if (!enabled || disposed || current !== revision) return;
      root.replaceChildren();
      const error = root.ownerDocument.createElement('p');
      error.setAttribute('role', 'alert');
      error.textContent = failure instanceof Error ? failure.message : 'Could not load your activity.';
      const retry = root.ownerDocument.createElement('button');
      retry.type = 'button'; retry.textContent = 'Retry'; retry.addEventListener('click', () => { void refresh(); });
      root.append(error, retry);
    }
  };
  const render = (saved: SavedItem[]): void => {
    const doc = root.ownerDocument;
    root.replaceChildren();
    const hero = doc.createElement('div'); hero.className = 'home-hero';
    const eyebrow = doc.createElement('p'); eyebrow.className = 'home-eyebrow'; eyebrow.textContent = 'UNHAUL';
    const name = doc.createElement('h3'); name.className = 'home-name'; name.textContent = 'Shop with intention.';
    const promise = doc.createElement('p'); promise.className = 'home-promise'; promise.textContent = 'A pause before your next impulse purchase.';
    const problem = doc.createElement('p'); problem.className = 'home-problem'; problem.textContent = 'Online shopping is designed to make buying effortless. Unhaul helps you slow down, reflect on what you already own, and make purchases you feel good about.';
    hero.append(eyebrow, name, promise, problem);

    const summary = doc.createElement('div'); summary.className = 'summary-tiles';
    const summaryHeading = doc.createElement('h3'); summaryHeading.className = 'summary-heading'; summaryHeading.textContent = 'Your activity at a glance';
    root.append(summaryHeading);
    const counts = homeSummary(saved);
    for (const [label, value] of [['Waiting', String(counts.waiting)], ['Ready to decide', String(counts.ready)], ['Skipped', String(counts.skipped)]] as const) {
      const tile = doc.createElement('div'); tile.className = 'summary-tile'; const heading = doc.createElement('strong'); heading.textContent = value; const text = doc.createElement('span'); text.textContent = label; tile.append(heading, text); summary.append(tile);
    }
    const moneyTile = doc.createElement('div'); moneyTile.className = 'summary-tile'; const moneyText = doc.createElement('span'); moneyText.textContent = 'Money not spent';
    moneyTile.append(moneyText);
    for (const [currency, value] of Object.entries(counts.notSpent)) { const line = doc.createElement('strong'); line.textContent = formatPrice(value, currency); moneyTile.append(line); }
    if (!Object.keys(counts.notSpent).length) { const line = doc.createElement('strong'); line.textContent = '—'; moneyTile.append(line); }
    summary.append(moneyTile); root.append(summary);
    const stores = doc.createElement('p'); stores.className = 'stores-note'; stores.textContent = `Supported stores: ${SUPPORTED_STORE_NAMES.join(', ')}`; root.append(stores);
  };
  return {
    refresh,
    setEnabled(value: boolean) { if (disposed || enabled === value) return; enabled = value; revision++; if (enabled) void refresh(); else root.replaceChildren(); },
    dispose() { disposed = true; enabled = false; revision++; root.replaceChildren(); },
  };
}
