import { browser } from 'wxt/browser';
import { storageClient } from '../../src/storage/client';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { createOptionsController } from './controller';
import './style.css';
import { proxyConfig } from '../../src/classify/config';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const consent = element<HTMLElement>('consent');
const app = element<HTMLElement>('app');
const status = element<HTMLElement>('status');
const error = element<HTMLElement>('error');
const retry = element<HTMLButtonElement>('retry');
if (proxyConfig().url) element('ai-state').textContent = 'This build is configured to request AI classification. When available, refinement sends the public product information described above; failures use local keyword matching.';
let previousScreen = 'loading';
const controller = createOptionsController(storageClient, state => {
  const focusHidden = (app.contains(document.activeElement) && state.screen !== 'items')
    || (consent.contains(document.activeElement) && state.screen !== 'consent');
  consent.hidden = state.screen !== 'consent';
  app.hidden = state.screen !== 'items';
  retry.hidden = state.screen !== 'error';
  status.textContent = state.status;
  error.hidden = !state.error;
  error.textContent = state.error ?? '';
  app.setAttribute('aria-busy', String(state.busy));
  consent.setAttribute('aria-busy', String(state.busy));
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = state.busy;
  const rows = state.items.map(item => {
    const row = document.createElement('li');
    row.textContent = `${item.name} — ${item.itemType}`;
    return row;
  });
  element<HTMLUListElement>('items').replaceChildren(...rows);
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
element('delete-data').addEventListener('click', () => { void controller.deleteData(); });
retry.addEventListener('click', () => { void controller.refresh(); });
const onStorageChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
  if (area === 'local' && Object.hasOwn(changes, STORAGE_KEYS.settings)) {
    controller.settingsChanged(changes[STORAGE_KEYS.settings].newValue);
  }
};
browser.storage.onChanged.addListener(onStorageChanged);
void controller.refresh();
