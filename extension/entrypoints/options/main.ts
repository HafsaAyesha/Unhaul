import { browser } from 'wxt/browser';
import { storageClient } from '../../src/storage/client';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { createSavedList } from './saved-list';
import { createDashboard } from './dashboard';
import { createHome, SUPPORTED_STORE_NAMES } from './home';
import { createRouter } from './router';
import { createOptionsController, label } from './controller';
import { CATEGORIES, ITEM_TYPES, PURPOSES, type Category, type ItemType, type Purpose } from '../../src/shared/lists';
import './style.css';
import { proxyConfig } from '../../src/classify/config';
import { isCustomSitesResponse } from '../../src/shared/messages';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const consent = element<HTMLElement>('consent');
const app = element<HTMLElement>('app');
const status = element<HTMLElement>('status');
const error = element<HTMLElement>('error');
const retry = element<HTMLButtonElement>('retry');
const cooldownLock = element<HTMLInputElement>('cooldown-lock');
const customSites = element<HTMLUListElement>('custom-sites');
const customSiteInput = element<HTMLInputElement>('custom-site-input');
const addSiteCard = element<HTMLElement>('add-site-card');
const addSiteStatus = element<HTMLElement>('add-site-status');
const appShell = element<HTMLElement>('app-shell');
if (proxyConfig().url) {
  const aiText = 'This build is configured to request AI classification. When available, refinement sends the public product information described above; failures use local keyword matching.';
  element('ai-state').textContent = aiText;
  element('consent-ai-state').textContent = aiText;
}
const quickAdd = element<HTMLFormElement>('quick-add');
const categorySelect = element<HTMLSelectElement>('qa-category');
const typeSelect = element<HTMLSelectElement>('qa-type');
const purposeSelect = element<HTMLSelectElement>('qa-purpose');
async function syncCooldownLock(): Promise<void> {
  try {
    cooldownLock.checked = (await storageClient.getSettings()).cooldownLock !== false;
  } catch (failure) {
    error.hidden = false;
    error.textContent = failure instanceof Error ? failure.message : 'Could not load cooling-off lock setting.';
  }
}
function requestedOrigins(origin: string): string[] {
  const host = new URL(origin).hostname;
  return [`${origin}/*`, ...(host.startsWith('www.') ? [] : [`https://www.${host}/*`])];
}
function normalizeSiteInput(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || /^[\d.]+$/.test(host)
      || ['chrome.google.com', 'chromewebstore.google.com', 'webstore.google.com', 'extensions.google.com'].includes(host)) return null;
    return `https://${host}`;
  } catch { return null; }
}
async function refreshCustomSites(): Promise<void> {
  const reply: unknown = await browser.runtime.sendMessage({ type: 'LIST_CUSTOM_SITES' });
  if (!isCustomSitesResponse(reply)) throw new Error('Could not load added sites.');
  customSites.replaceChildren(...reply.origins.map(origin => {
    const row = document.createElement('li');
    row.textContent = origin;
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      void browser.permissions.remove({ origins: requestedOrigins(origin) }).then(() => refreshCustomSites()).catch((failure: unknown) => {
        error.hidden = false; error.textContent = failure instanceof Error ? failure.message : 'Could not remove this site.';
      });
    });
    row.append(' ', remove);
    return row;
  }));
}
async function requestSite(origin: string, statusNode: HTMLElement): Promise<void> {
  const granted = await browser.permissions.request({ origins: requestedOrigins(origin) });
  statusNode.textContent = granted ? 'Enabled. Reload the store tab to start.' : 'Permission not granted.';
  if (granted) void refreshCustomSites();
}
const option = (value: string, text: string) => { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; };
categorySelect.replaceChildren(...CATEGORIES.map(c => option(c, label(c))));
purposeSelect.replaceChildren(option('', 'Default for this type'), ...PURPOSES.map(p => option(p, label(p))));
const fillTypes = () => {
  const types: readonly ItemType[] = ITEM_TYPES[categorySelect.value as Category];
  typeSelect.replaceChildren(...types.map(t => option(t, label(t))));
};
categorySelect.addEventListener('change', fillTypes);
fillTypes();
let savedList = createSavedList(element('saved-list'), storageClient);
let dashboard = createDashboard(element('dashboard'), storageClient);
let router: ReturnType<typeof createRouter>;
let home: ReturnType<typeof createHome>;
let previousScreen = 'loading';
function addSiteOriginFromHash(): string | null {
  const value = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '').get('add-site');
  return value ? normalizeSiteInput(value) : null;
}
function renderAddSiteCard(): void {
  const origin = addSiteOriginFromHash();
  addSiteCard.hidden = !origin;
  appShell.hidden = Boolean(origin);
  if (origin) {
    addSiteCard.querySelector('h2')!.textContent = `Use Unhaul on ${new URL(origin).hostname}?`;
    addSiteStatus.textContent = '';
  }
}
const syncViews = (screen: string, busy: boolean) => {
  const active = screen === 'items' && !busy;
  savedList.setEnabled(active && router.current === 'saved');
  dashboard.setEnabled(active && router.current === 'dashboard');
  home.setEnabled(active && router.current === 'home');
};
const controller = createOptionsController(storageClient, state => {
  const focusHidden = (app.contains(document.activeElement) && state.screen !== 'items')
    || (consent.contains(document.activeElement) && state.screen !== 'consent');
  consent.hidden = state.screen !== 'consent';
  app.hidden = state.screen !== 'items';
  syncViews(state.screen, state.busy);
  retry.hidden = state.screen !== 'error';
  status.textContent = state.status;
  element('settings-consent').textContent = state.screen === 'items' ? 'Unhaul is enabled.' : 'Unhaul is not enabled.';
  error.hidden = !state.error;
  error.textContent = state.error ?? '';
  app.setAttribute('aria-busy', String(state.busy));
  consent.setAttribute('aria-busy', String(state.busy));
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = state.busy;
  const rows = state.items.map(item => {
    const row = document.createElement('li');
    row.className = 'item-row';
    const text = document.createElement('span');
    const purpose = item.purpose ? `, ${label(item.purpose)}` : '';
    text.textContent = `${item.name} (${label(item.itemType)}, ${label(item.category)}${purpose})${item.notes ? ` — ${item.notes}` : ''}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${item.name}`);
    remove.disabled = state.busy;
    remove.addEventListener('click', () => { void controller.deleteItem(item.id); });
    row.append(text, remove);
    return row;
  });
  element<HTMLUListElement>('items').replaceChildren(...rows);
  element('items-empty').hidden = state.screen !== 'items' || state.items.length > 0;
  for (const field of quickAdd.elements) (field as HTMLInputElement).disabled = state.busy;
  if (state.screen !== previousScreen && state.screen !== 'loading') {
    if (focusHidden || previousScreen === 'loading') {
      if (state.screen === 'consent') element<HTMLElement>('consent-title').focus();
      else if (state.screen === 'items') element<HTMLElement>('items-title').focus();
      else retry.focus();
    }
  }
  previousScreen = state.screen;
});
home = createHome(element('home-content'), storageClient, view => router.navigate(view), () => {
  router.navigate('items');
  void controller.loadSamples();
});
router = createRouter(document, view => {
  const stateScreen = previousScreen;
  syncViews(stateScreen, stateScreen === 'loading' || stateScreen === 'error');
  renderAddSiteCard();
});
window.addEventListener('hashchange', renderAddSiteCard);
element('allow-site').addEventListener('click', () => {
  const origin = addSiteOriginFromHash();
  if (!origin) return;
  void requestSite(origin, addSiteStatus).catch(failure => {
    addSiteStatus.textContent = failure instanceof Error ? failure.message : 'Permission not granted.';
  });
});
element('not-now-site').addEventListener('click', () => router.navigate('home'));
element('add-custom-site').addEventListener('click', () => {
  const origin = normalizeSiteInput(customSiteInput.value);
  if (!origin) {
    error.hidden = false; error.textContent = 'Enter an HTTPS origin without a path, port or credentials.';
    return;
  }
  void requestSite(origin, status).then(() => { customSiteInput.value = ''; }).catch(failure => {
    error.hidden = false; error.textContent = failure instanceof Error ? failure.message : 'Permission not granted.';
  });
});
void refreshCustomSites().catch(() => {});
element('settings-stores').textContent = SUPPORTED_STORE_NAMES.join(', ');
element('version').textContent = `Version ${browser.runtime.getManifest().version}`;
element('agree').addEventListener('click', () => { void controller.agree(); });
element('not-now').addEventListener('click', controller.notNow);
element('load-sample').addEventListener('click', () => { void controller.loadSamples(); });
element('turn-off').addEventListener('click', () => { void controller.turnOff(); });
cooldownLock.addEventListener('change', () => {
  const value = cooldownLock.checked;
  void storageClient.setCooldownLock(value).catch(failure => {
    cooldownLock.checked = !value;
    error.hidden = false;
    error.textContent = failure instanceof Error ? failure.message : 'Could not save cooling-off lock setting.';
  });
});
quickAdd.addEventListener('submit', event => {
  event.preventDefault(); // our own form, not a store page
  const notes = element<HTMLTextAreaElement>('qa-notes');
  const name = element<HTMLInputElement>('qa-name');
  void controller.addItem({
    name: name.value,
    category: categorySelect.value as Category,
    itemType: typeSelect.value as ItemType,
    purpose: purposeSelect.value as Purpose | '',
    notes: notes.value,
  }).then(added => {
    if (!added) return;
    name.value = ''; notes.value = ''; purposeSelect.value = '';
    name.focus();
  });
});
const deleteConfirm = element<HTMLElement>('delete-confirm');
element('delete-data').addEventListener('click', () => { deleteConfirm.hidden = false; });
element('delete-data-confirm').addEventListener('click', () => { deleteConfirm.hidden = true; void controller.deleteData(); });
element('delete-cancel').addEventListener('click', () => { deleteConfirm.hidden = true; });
retry.addEventListener('click', () => { void controller.refresh(); });
const onStorageChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
  if (area === 'local' && Object.hasOwn(changes, STORAGE_KEYS.settings)) {
    controller.settingsChanged(changes[STORAGE_KEYS.settings].newValue);
    void syncCooldownLock();
    void home.refresh();
  }
  if (area === 'local' && Object.hasOwn(changes, STORAGE_KEYS.saved)) {
    void savedList.refresh();
    void dashboard.refresh();
    void home.refresh();
  }
  if (area === 'local' && Object.hasOwn(changes, STORAGE_KEYS.items)) {
    void dashboard.refresh();
    void home.refresh();
  }
};
browser.storage.onChanged.addListener(onStorageChanged);
void controller.refresh();
void syncCooldownLock();

window.addEventListener('pagehide', () => { savedList.dispose(); dashboard.dispose(); home.dispose(); });
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    savedList = createSavedList(element('saved-list'), storageClient);
    dashboard = createDashboard(element('dashboard'), storageClient);
    home = createHome(element('home-content'), storageClient, view => router.navigate(view), () => {
      router.navigate('items');
      void controller.loadSamples();
    });
    void controller.refresh();
  }
});
