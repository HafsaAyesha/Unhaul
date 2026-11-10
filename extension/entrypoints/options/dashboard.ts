import { LABELS } from '../../src/shared/lists';
import type { OwnedItem, SavedItem } from '../../src/shared/types';
import { formatPrice } from '../../src/ui/price';
import { computeDashboard } from './dashboard-stats';

interface DashboardClient {
  getItems(): Promise<OwnedItem[]>;
  getSavedItems(): Promise<SavedItem[]>;
}

function safeURL(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function createDashboard(root: HTMLElement, client: DashboardClient) {
  const doc = root.ownerDocument;
  let enabled = false;
  let disposed = false;
  let revision = 0;
  const notice = doc.createElement('p');
  notice.setAttribute('role', 'status');
  const error = doc.createElement('p');
  error.setAttribute('role', 'alert');
  const retry = doc.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry dashboard';
  retry.hidden = true;
  const content = doc.createElement('div');
  root.replaceChildren(notice, error, retry, content);

  function titleNode(item: SavedItem): HTMLElement {
    const title = doc.createElement('span');
    const href = safeURL(item.product.url);
    if (href) {
      const link = doc.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.product.title;
      title.append(link);
    } else title.textContent = item.product.title;
    return title;
  }

  function render(items: OwnedItem[], saved: SavedItem[]): void {
    const stats = computeDashboard(items, saved);
    content.replaceChildren();
    const tiles = doc.createElement('div');
    tiles.className = 'dashboard-tiles';
    for (const [label, value] of [
      ['Waiting', stats.saved.waiting],
      ['Ready to decide', stats.saved.ready],
      ['Skipped', stats.saved.skipped],
      ['Purchased (self-reported)', stats.saved.purchased],
    ] as const) {
      const tile = doc.createElement('div');
      tile.className = 'dashboard-tile';
      const heading = doc.createElement('h3');
      heading.textContent = label;
      const count = doc.createElement('strong');
      count.textContent = String(value);
      tile.append(heading, count);
      tiles.append(tile);
    }
    content.append(tiles);

    const money = doc.createElement('section');
    const moneyHeading = doc.createElement('h3');
    moneyHeading.textContent = 'Money not spent (from skipped items)';
    money.append(moneyHeading);
    for (const [currency, amount] of Object.entries(stats.notSpent)) {
      const line = doc.createElement('p');
      line.textContent = formatPrice(amount, currency);
      money.append(line);
    }
    if (stats.unpricedSkipped) {
      const line = doc.createElement('p');
      line.textContent = `${stats.unpricedSkipped} skipped item${stats.unpricedSkipped === 1 ? '' : 's'} had no price`;
      money.append(line);
    }
    const note = doc.createElement('p');
    note.textContent = 'Estimate based on prices when saved.';
    money.append(note);
    content.append(money);

    const owned = doc.createElement('section');
    const ownedHeading = doc.createElement('h3');
    ownedHeading.textContent = 'What you own';
    const ownedList = doc.createElement('ul');
    for (const entry of stats.ownedByCategory) {
      const row = doc.createElement('li');
      row.textContent = `${LABELS[entry.category]}: ${entry.count}`;
      ownedList.append(row);
    }
    owned.append(ownedHeading, ownedList);
    content.append(owned);

    const recent = doc.createElement('section');
    const recentHeading = doc.createElement('h3');
    recentHeading.textContent = 'Recent decisions';
    recent.append(recentHeading);
    const recentList = doc.createElement('ul');
    for (const item of stats.recentDecisions) {
      const row = doc.createElement('li');
      const status = item.status === 'skipped' ? 'Skipped' : 'Purchased';
      row.append(titleNode(item), doc.createTextNode(` — ${status}, ${new Date(item.decidedAt ?? item.savedAt).toLocaleDateString()}`));
      recentList.append(row);
    }
    recent.append(recentList);
    content.append(recent);
  }

  async function refresh(): Promise<void> {
    if (!enabled || disposed) return;
    const current = ++revision;
    notice.textContent = 'Loading dashboard…';
    error.textContent = '';
    retry.hidden = true;
    try {
      const [items, saved] = await Promise.all([client.getItems(), client.getSavedItems()]);
      if (!enabled || disposed || current !== revision) return;
      render(items, saved);
      notice.textContent = items.length || saved.length ? 'Purchased is self-reported. Unhaul does not verify orders.' : 'No data yet. Load sample items or save a product for later.';
    } catch (failure) {
      if (enabled && !disposed && current === revision) {
        notice.textContent = '';
        error.textContent = failure instanceof Error ? failure.message : 'Could not load dashboard.';
        retry.hidden = false;
      }
    }
  }

  retry.addEventListener('click', () => { void refresh(); });
  return {
    refresh,
    setEnabled(value: boolean) {
      if (disposed || enabled === value) return;
      enabled = value;
      revision++;
      if (enabled) void refresh();
      else { content.replaceChildren(); notice.textContent = ''; error.textContent = ''; retry.hidden = true; }
    },
    dispose() {
      disposed = true;
      enabled = false;
      revision++;
      root.replaceChildren();
    },
  };
}
