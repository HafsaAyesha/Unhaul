import type { SavedItem } from '../../src/shared/types';
import { remainingLabel } from '../../src/shared/cooling';
interface SavedClient {
  getSavedItems(): Promise<SavedItem[]>;
  decideSavedItem(id: string, status: 'skipped' | 'purchased'): Promise<SavedItem>;
}
function safeURL(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function createSavedList(root: HTMLElement, client: SavedClient) {
  const doc = root.ownerDocument; const win = doc.defaultView!;
  let enabled = false; let disposed = false; let revision = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let labels: { node: HTMLElement; item: SavedItem }[] = [];
  const notice = doc.createElement('p'); notice.setAttribute('role', 'status');
  const error = doc.createElement('p'); error.setAttribute('role', 'alert');
  const retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry saved list'; retry.hidden = true;
  const active = doc.createElement('div'); const history = doc.createElement('div');
  root.replaceChildren(notice, error, retry, active, history);
  function tick(): void {
    if (!enabled || disposed || doc.visibilityState === 'hidden') return;
    for (const { node, item } of labels) node.textContent = remainingLabel(item);
  }
  function syncTimer(): void {
    clearInterval(timer); timer = undefined;
    if (enabled && !disposed && doc.visibilityState !== 'hidden') timer = setInterval(tick, 1000);
  }
  function itemCard(item: SavedItem): HTMLElement {
    const card = doc.createElement('article'); card.className = 'saved-card'; card.dataset.savedId = item.id;
    const title = doc.createElement('h4');
    const href = safeURL(item.product.url);
    if (href) {
      const link = doc.createElement('a'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = item.product.title; title.append(link);
    } else title.textContent = item.product.title;
    card.append(title);
    const imageURL = safeURL(item.product.imageUrl);
    if (imageURL) {
      const image = doc.createElement('img'); image.src = imageURL; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.crossOrigin = 'anonymous';
      image.addEventListener('error', () => image.remove()); card.append(image);
    }
    const price = doc.createElement('p');
    if (item.product.price !== null && item.product.currency) {
      try { price.textContent = new Intl.NumberFormat('en-PK', { style: 'currency', currency: item.product.currency }).format(item.product.price); }
      catch { price.textContent = `${item.product.currency} ${item.product.price}`; }
    } else price.textContent = 'Price unavailable';
    const saved = doc.createElement('p'); saved.textContent = `Saved ${new Date(item.savedAt).toLocaleString()}`;
    const clock = doc.createElement('p'); clock.className = 'saved-time'; labels.push({ node: clock, item });
    const deadline = doc.createElement('p'); deadline.textContent = `Reconsider ${new Date(item.reconsiderAt ?? item.deadline).toLocaleString()}`;
    card.append(price, saved, clock, deadline);
    if (item.status === 'waiting') {
      for (const [label, decision] of [['Skip', 'skipped'], ['Purchased', 'purchased']] as const) {
        const button = doc.createElement('button'); button.type = 'button'; button.textContent = label;
        button.addEventListener('click', async () => {
          if (!enabled || disposed) return;
          const current = revision;
          card.querySelectorAll('button').forEach(control => { control.disabled = true; });
          error.textContent = ''; notice.textContent = 'Saving your decision…';
          try {
            await client.decideSavedItem(item.id, decision);
            if (enabled && !disposed && current === revision) await refresh();
          } catch (failure) {
            if (enabled && !disposed && current === revision) {
              error.textContent = failure instanceof Error ? failure.message : 'Could not save your decision. Please retry.';
              notice.textContent = ''; card.querySelectorAll('button').forEach(control => { control.disabled = false; });
            }
          }
        });
        card.append(button);
      }
    } else {
      const decided = doc.createElement('p'); decided.textContent = item.decidedAt === undefined ? 'Earlier decision (time not recorded)' : `Decided ${new Date(item.decidedAt).toLocaleString()}`; card.append(decided);
    }
    return card;
  }
  async function refresh(): Promise<void> {
    if (!enabled || disposed) return;
    const current = ++revision;
    notice.textContent = 'Loading saved items…'; error.textContent = ''; retry.hidden = true;
    active.replaceChildren(); history.replaceChildren(); labels = [];
    try {
      const records = await client.getSavedItems();
      if (!enabled || disposed || current !== revision) return;
      const waiting = records.filter(item => item.status === 'waiting');
      const decided = records.filter(item => item.status !== 'waiting');
      for (const [container, title, items] of [[active, 'Waiting and Ready', waiting], [history, 'Decision history', decided]] as const) {
        if (!items.length) continue;
        const heading = doc.createElement('h3'); heading.textContent = title; container.append(heading);
        items.forEach(item => container.append(itemCard(item)));
      }
      notice.textContent = records.length ? 'Purchased is self-reported. Unhaul does not verify orders.' : 'No saved items yet. Use Save for later on a supported product page.';
      tick(); syncTimer();
    } catch (failure) {
      if (enabled && !disposed && current === revision) {
        notice.textContent = ''; error.textContent = failure instanceof Error ? failure.message : 'Could not load saved items.'; retry.hidden = false;
      }
    }
  }
  retry.addEventListener('click', () => { void refresh(); });
  const onVisible = () => { syncTimer(); if (doc.visibilityState !== 'hidden') void refresh(); };
  const onFocus = () => { if (enabled) void refresh(); };
  doc.addEventListener('visibilitychange', onVisible); win.addEventListener('focus', onFocus);
  return {
    refresh,
    setEnabled(value: boolean) {
      if (disposed || enabled === value) return;
      enabled = value; revision++; syncTimer();
      if (enabled) void refresh();
      else { active.replaceChildren(); history.replaceChildren(); labels = []; notice.textContent = ''; error.textContent = ''; retry.hidden = true; }
    },
    dispose() {
      disposed = true; enabled = false; revision++; clearInterval(timer); labels = []; root.replaceChildren();
      doc.removeEventListener('visibilitychange', onVisible); win.removeEventListener('focus', onFocus);
    },
  };
}
