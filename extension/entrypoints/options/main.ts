import { browser } from 'wxt/browser';
import { storageClient } from '../../src/storage/client';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { createSavedList } from './saved-list';
import { createDashboard } from './dashboard';
import { createOptionsController, label } from './controller';
import { CATEGORIES, ITEM_TYPES, PURPOSES, type Category, type ItemType, type Purpose } from '../../src/shared/lists';
import './style.css';
import { proxyConfig } from '../../src/classify/config';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const consent = element<HTMLElement>('consent');
const app = element<HTMLElement>('app');
const status = element<HTMLElement>('status');
const error = element<HTMLElement>('error');
const retry = element<HTMLButtonElement>('retry');
if (proxyConfig().url) element('ai-state').textContent = 'This build is configured to request AI classification. When available, refinement sends the public product information described above; failures use local keyword matching.';
const quickAdd = element<HTMLFormElement>('quick-add');
const categorySelect = element<HTMLSelectElement>('qa-category');
const typeSelect = element<HTMLSelectElement>('qa-type');
const purposeSelect = element<HTMLSelectElement>('qa-purpose');
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
let previousScreen = 'loading';
const controller = createOptionsController(storageClient, state => {
  const focusHidden = (app.contains(document.activeElement) && state.screen !== 'items')
    || (consent.contains(document.activeElement) && state.screen !== 'consent');
  consent.hidden = state.screen !== 'consent';
  app.hidden = state.screen !== 'items';
  savedList.setEnabled(state.screen === 'items' && !state.busy);
  dashboard.setEnabled(state.screen === 'items' && !state.busy);
  retry.hidden = state.screen !== 'error';
  status.textContent = state.status;
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
element('agree').addEventListener('click', () => { void controller.agree(); });
element('not-now').addEventListener('click', controller.notNow);
element('load-sample').addEventListener('click', () => { void controller.loadSamples(); });
element('turn-off').addEventListener('click', () => { void controller.turnOff(); });
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
element('delete-data').addEventListener('click', () => { void controller.deleteData(); });
retry.addEventListener('click', () => { void controller.refresh(); });
const onStorageChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
  if (area === 'local' && Object.hasOwn(changes, STORAGE_KEYS.settings)) {
    controller.settingsChanged(changes[STORAGE_KEYS.settings].newValue);
  }
  if (area === 'local' && Object.hasOwn(changes, STORAGE_KEYS.saved)) {
    void savedList.refresh();
    void dashboard.refresh();
  }
  if (area === 'local' && Object.hasOwn(changes, STORAGE_KEYS.items)) {
    void dashboard.refresh();
  }
};
browser.storage.onChanged.addListener(onStorageChanged);
void controller.refresh();

window.addEventListener('pagehide', () => { savedList.dispose(); dashboard.dispose(); });
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    savedList = createSavedList(element('saved-list'), storageClient);
    dashboard = createDashboard(element('dashboard'), storageClient);
    void controller.refresh();
  }
});
