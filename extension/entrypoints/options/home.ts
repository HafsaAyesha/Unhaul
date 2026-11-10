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
    loading.textContent = 'Loading your journey…';
    root.append(loading);
    try {
      const [settings, items, saved] = await Promise.all([client.getSettings(), client.getItems(), client.getSavedItems()]);
      if (!enabled || disposed || current !== revision) return;
      render(settings, items, saved);
    } catch (failure) {
      if (!enabled || disposed || current !== revision) return;
      root.replaceChildren();
      const error = root.ownerDocument.createElement('p');
      error.setAttribute('role', 'alert');
      error.textContent = failure instanceof Error ? failure.message : 'Could not load your journey.';
      const retry = root.ownerDocument.createElement('button');
      retry.type = 'button'; retry.textContent = 'Retry'; retry.addEventListener('click', () => { void refresh(); });
      root.append(error, retry);
    }
  };
  const render = (settings: Settings, items: OwnedItem[], saved: SavedItem[]): void => {
    const doc = root.ownerDocument;
    root.replaceChildren();
    const hero = doc.createElement('div'); hero.className = 'home-hero';
    const greeting = doc.createElement('p'); greeting.className = 'home-eyebrow'; greeting.textContent = 'YOUR UNHAUL JOURNEY';
    const promise = doc.createElement('p'); promise.className = 'home-promise'; promise.textContent = 'A pause before your next impulse purchase.';
    const intro = doc.createElement('p'); intro.className = 'home-intro'; intro.textContent = 'Build a small, thoughtful shopping habit—one decision at a time.';
    hero.append(greeting, promise, intro);
    const steps = journeySteps(settings, items, saved);
    const complete = steps.filter(step => step.done).length;
    const progressHeader = doc.createElement('div'); progressHeader.className = 'journey-header';
    const progressTitle = doc.createElement('h3'); progressTitle.textContent = 'Your journey';
    const progress = doc.createElement('p'); progress.className = 'progress'; progress.textContent = `${complete} of ${steps.length} done`;
    progressHeader.append(progressTitle, progress);
    const progressTrack = doc.createElement('div'); progressTrack.className = 'progress-track';
    const progressBar = doc.createElement('div'); progressBar.className = 'progress-bar'; progressBar.style.width = `${(complete / steps.length) * 100}%`;
    progressTrack.append(progressBar);
    const checklist = doc.createElement('ol'); checklist.className = 'journey-list';
    for (const step of steps) {
      const row = doc.createElement('li'); row.className = step.done ? 'done' : '';
      row.textContent = `${step.done ? 'Done: ' : ''}${step.title}`;
      if (!step.done && step.id === 'owned') {
        const actions = doc.createElement('div'); actions.className = 'journey-actions';
        const sample = doc.createElement('button'); sample.type = 'button'; sample.textContent = 'Load sample items'; sample.addEventListener('click', onLoadSamples);
        const add = doc.createElement('button'); add.type = 'button'; add.textContent = 'Add an item'; add.addEventListener('click', () => onNavigate('items'));
        actions.append(sample, add); row.append(actions);
      }
      checklist.append(row);
    }
    const next = steps.find(step => !step.done);
    const nextCard = doc.createElement('div'); nextCard.className = 'next-step';
    const nextText = doc.createElement('p'); nextText.textContent = next ? `Next step: ${next.title}` : 'You are all set. Keep taking a moment before you buy.';
    nextCard.append(nextText);
    if (next?.id === 'owned') {
      const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'Add an item'; button.addEventListener('click', () => onNavigate('items')); nextCard.append(button);
    } else if (next?.id === 'saved') {
      const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'View saved items'; button.addEventListener('click', () => onNavigate('saved')); nextCard.append(button);
    } else if (next?.id === 'decision') {
      const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'View saved items'; button.addEventListener('click', () => onNavigate('saved')); nextCard.append(button);
    }
    const journey = doc.createElement('section'); journey.className = 'journey-panel';
    journey.append(progressHeader, progressTrack, checklist, nextCard);
    root.append(hero, journey);

    const summary = doc.createElement('div'); summary.className = 'summary-tiles';
    const summaryHeading = doc.createElement('h3'); summaryHeading.className = 'summary-heading'; summaryHeading.textContent = 'At a glance';
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
