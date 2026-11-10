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

type IconName = 'home' | 'box' | 'clock' | 'chart' | 'gear' | 'leaf' | 'check' | 'lock';

function icon(doc: Document, name: IconName, size = 20): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const paths: Record<IconName, string> = {
    home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6',
    box: 'm4 7 8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
    chart: 'M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6',
    gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64',
    leaf: 'M20 4C11 4 5 8 5 14c0 3 2 5 5 5 6 0 10-6 10-15ZM4 21c3-4 6-7 11-9',
    check: 'm5 12 4 4L19 6',
    lock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',
  };
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[name]);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function priceText(item: SavedItem): string {
  return item.product.price !== null && item.product.currency
    ? formatPrice(item.product.price, item.product.currency)
    : 'Price unavailable';
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
    loading.className = 'sr-only';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading your activity…';
    const skeleton = root.ownerDocument.createElement('div');
    skeleton.className = 'home-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    skeleton.append(...Array.from({ length: 5 }, () => {
      const block = root.ownerDocument.createElement('div');
      block.className = 'skeleton-block';
      return block;
    }));
    root.append(loading, skeleton);
    try {
      const [settings, items, saved] = await Promise.all([client.getSettings(), client.getItems(), client.getSavedItems()]);
      if (!enabled || disposed || current !== revision) return;
      render(settings, items, saved);
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
  const render = (settings: Settings, items: OwnedItem[], saved: SavedItem[]): void => {
    const doc = root.ownerDocument;
    root.replaceChildren();
    const steps = journeySteps(settings, items, saved);
    const complete = steps.filter(step => step.done).length;
    const currentStep = steps.find(step => !step.done);
    const hero = doc.createElement('section'); hero.className = 'home-hero card';
    const heroCopy = doc.createElement('div'); heroCopy.className = 'hero-copy';
    const eyebrow = doc.createElement('p'); eyebrow.className = 'home-eyebrow'; eyebrow.textContent = 'WELCOME TO UNHAUL';
    const greeting = doc.createElement('p'); greeting.className = 'home-greeting'; greeting.textContent = `${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}.`;
    const title = doc.createElement('h3'); title.className = 'home-title'; title.textContent = 'Shop with intention.';
    const promise = doc.createElement('p'); promise.className = 'home-promise'; promise.textContent = 'A pause before your next impulse purchase.';
    const problem = doc.createElement('p'); problem.className = 'home-problem'; problem.textContent = 'Online shopping is designed to make buying effortless. Unhaul helps you slow down, reflect on what you already own, and make purchases you feel good about.';
    const heroActions = doc.createElement('div'); heroActions.className = 'hero-actions';
    if (currentStep?.id === 'owned') {
      const primary = doc.createElement('button'); primary.className = 'btn btn-primary'; primary.type = 'button'; primary.textContent = 'Add an item'; primary.addEventListener('click', () => onNavigate('items')); heroActions.append(primary);
    } else {
      const primary = doc.createElement('button'); primary.className = 'btn btn-primary'; primary.type = 'button'; primary.textContent = 'View saved items'; primary.addEventListener('click', () => onNavigate('saved')); heroActions.append(primary);
    }
    const secondary = doc.createElement('a'); secondary.className = 'btn btn-ghost'; secondary.href = '#saved'; secondary.textContent = 'View saved items';
    heroActions.append(secondary);
    heroCopy.append(eyebrow, greeting, title, promise, problem, heroActions);
    const ringWrap = doc.createElement('div'); ringWrap.className = 'progress-ring-wrap';
    const ring = doc.createElement('div'); ring.className = 'progress-ring';
    const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); circle.setAttribute('viewBox', '0 0 100 100'); circle.setAttribute('aria-label', `${complete} of ${steps.length} journey steps complete`);
    const track = doc.createElementNS('http://www.w3.org/2000/svg', 'circle'); track.setAttribute('cx', '50'); track.setAttribute('cy', '50'); track.setAttribute('r', '42'); track.classList.add('ring-track');
    const progressCircle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle'); progressCircle.setAttribute('cx', '50'); progressCircle.setAttribute('cy', '50'); progressCircle.setAttribute('r', '42'); progressCircle.classList.add('ring-progress'); progressCircle.style.strokeDasharray = `${(complete / steps.length) * 264} 264`;
    circle.append(track, progressCircle); ring.append(circle);
    const ringText = doc.createElement('strong'); ringText.textContent = `${complete} of ${steps.length}`;
    const ringLabel = doc.createElement('span'); ringLabel.textContent = 'Your journey';
    ringWrap.append(ring, ringText, ringLabel);
    hero.append(heroCopy, ringWrap);
    root.append(hero);

    const counts = homeSummary(saved);
    const summary = doc.createElement('section'); summary.className = 'home-section';
    const summaryHeading = doc.createElement('h3'); summaryHeading.textContent = 'At a glance'; summary.append(summaryHeading);
    const stats = doc.createElement('div'); stats.className = 'stats-grid';
    const statData: Array<[IconName, string, string, string]> = [['clock', String(counts.waiting), 'Waiting', 'Cooling-off items'], ['clock', String(counts.ready), 'Ready to decide', counts.ready > 0 ? 'A decision is waiting' : 'Nothing due yet'], ['check', String(counts.skipped), 'Skipped', 'Purchases reconsidered'], ['chart', '', 'Money not spent', 'From skipped items']];
    for (const [iconName, value, label, hint] of statData) {
      const tile = doc.createElement('article'); tile.className = `stat ${label === 'Ready to decide' && counts.ready > 0 ? 'stat-warning' : ''}`;
      const iconCircle = doc.createElement('span'); iconCircle.className = 'stat-icon'; iconCircle.append(icon(doc, iconName));
      const valueNode = doc.createElement('strong'); valueNode.className = 'stat-value'; valueNode.textContent = value;
      const labelNode = doc.createElement('span'); labelNode.className = 'stat-label'; labelNode.textContent = label;
      const hintNode = doc.createElement('small'); hintNode.textContent = hint;
      tile.append(iconCircle, valueNode, labelNode, hintNode);
      if (label === 'Money not spent') {
        valueNode.textContent = '';
        for (const [currency, value] of Object.entries(counts.notSpent)) { const line = doc.createElement('strong'); line.className = 'stat-value stat-money'; line.textContent = formatPrice(value, currency); valueNode.append(line); }
        if (!Object.keys(counts.notSpent).length) valueNode.textContent = '—';
      }
      stats.append(tile);
    }
    summary.append(stats); root.append(summary);

    const journey = doc.createElement('section'); journey.className = 'home-section journey-section';
    const journeyTitle = doc.createElement('h3'); journeyTitle.textContent = 'Your journey'; journey.append(journeyTitle);
    const stepper = doc.createElement('div'); stepper.className = 'stepper';
    for (const [index, step] of steps.entries()) {
      const row = doc.createElement('article'); row.className = `step ${step.done ? 'step-done' : step === currentStep ? 'step-current' : ''}`;
      const marker = doc.createElement('span'); marker.className = 'step-marker'; marker.textContent = step.done ? '' : String(index + 1); if (step.done) marker.append(icon(doc, 'check', 16));
      const content = doc.createElement('div'); const stepTitle = doc.createElement('strong'); stepTitle.textContent = step.title;
      const description = doc.createElement('p'); description.textContent = ['Start with your consent and keep control of your data.', 'Add a few things you already own for better comparisons.', 'Give an impulse purchase time before deciding.', 'Mark the outcome that feels right for you.'][index];
      content.append(stepTitle, description);
      if (step === currentStep) {
        const action = doc.createElement('button'); action.className = 'btn btn-small'; action.type = 'button'; action.textContent = step.id === 'owned' ? 'Add an item' : 'View saved items'; action.addEventListener('click', () => onNavigate(step.id === 'owned' ? 'items' : 'saved')); content.append(action);
      }
      row.append(marker, content); stepper.append(row);
    }
    journey.append(stepper); root.append(journey);

    const twoColumn = doc.createElement('div'); twoColumn.className = 'home-columns';
    const readyCard = doc.createElement('section'); readyCard.className = 'card home-card'; const readyTitle = doc.createElement('h3'); readyTitle.textContent = 'Ready to decide'; readyCard.append(readyTitle);
    const readyItems = saved.filter(item => item.status === 'waiting' && (() => { try { return coolingState(item).ready; } catch { return false; } })()).slice(0, 3);
    if (!readyItems.length) {
      const empty = doc.createElement('div'); empty.className = 'empty-state'; empty.append(icon(doc, 'leaf', 32)); const emptyText = doc.createElement('p'); emptyText.textContent = 'Nothing to decide yet. Items you save appear here.'; empty.append(emptyText); readyCard.append(empty);
    } else {
      for (const item of readyItems) { const row = doc.createElement('div'); row.className = 'ready-item'; const text = doc.createElement('div'); const itemTitle = doc.createElement('strong'); itemTitle.textContent = item.product.title; const price = doc.createElement('span'); price.textContent = priceText(item); text.append(itemTitle, price); const link = doc.createElement('a'); link.href = '#saved'; link.textContent = 'Decide'; row.append(text, link); readyCard.append(row); }
    }
    const storesCard = doc.createElement('section'); storesCard.className = 'card home-card'; const storesTitle = doc.createElement('h3'); storesTitle.textContent = 'Supported stores'; storesCard.append(storesTitle);
    const pills = doc.createElement('div'); pills.className = 'pill-list'; for (const store of SUPPORTED_STORE_NAMES) { const pill = doc.createElement('span'); pill.className = 'pill'; pill.textContent = store; pills.append(pill); } storesCard.append(pills);
    const settingsLink = doc.createElement('a'); settingsLink.href = '#settings'; settingsLink.className = 'text-link'; settingsLink.textContent = 'Use Unhaul on another site'; storesCard.append(settingsLink);
    twoColumn.append(readyCard, storesCard); root.append(twoColumn);
    const footer = doc.createElement('p'); footer.className = 'home-footer'; footer.textContent = "Unhaul never blocks payment or changes a store's cart. Purchased is self-reported."; root.append(footer);
  };
  return {
    refresh,
    setEnabled(value: boolean) { if (disposed || enabled === value) return; enabled = value; revision++; if (enabled) void refresh(); else root.replaceChildren(); },
    dispose() { disposed = true; enabled = false; revision++; root.replaceChildren(); },
  };
}
