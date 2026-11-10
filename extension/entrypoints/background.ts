import { browser } from 'wxt/browser';
import { createAnalysisService } from '../src/classify/analysis';
import { isPingMessage, isGetConsentMessage, isProductRequest, type ConsentResponse, type ProductOperationError } from '../src/shared/messages';
import { initializeStorage, getSettings, beginConsentWork, claimPanelOpen, clearPanelSession, saveProduct, recordVisit, getCooldownLock } from '../src/storage/repo';
import { invalidateConsentWork } from '../src/consent/work';
import { STORAGE_KEYS } from '../src/storage/keys';
import { isSettings } from '../src/shared/storage-validation';
import { dispatchStorage } from '../src/storage/dispatch';
import { isStorageRequest, type StorageResponse } from '../src/shared/storage-messages';
import { record } from '../src/shared/storage-validation';
import { listCustomSites, normalizeOrigin, syncCustomContentScripts } from '../src/store/custom-sites';
import { STORE_HOST_PERMISSIONS } from '../src/store/stores';

export default defineBackground(() => {
  const analysis = createAnalysisService();
  const syncSites = () => { void syncCustomContentScripts().catch(error => console.error('[Unhaul] Custom site sync failed', error)); };
  browser.permissions?.onAdded?.addListener(syncSites);
  browser.permissions?.onRemoved?.addListener(syncSites);
  browser.action?.onClicked?.addListener(tab => {
    const origin = tab.url ? normalizeOrigin(tab.url) : null;
    if (origin && !STORE_HOST_PERMISSIONS.includes(`${origin}/*`)) {
      void browser.permissions.contains({ origins: [`${origin}/*`] }).then(granted => {
        if (granted) {
          void browser.runtime.openOptionsPage();
        } else {
          void browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#add-site=${encodeURIComponent(origin)}` });
        }
      }).catch(error => console.error('[Unhaul] Could not route toolbar action', error));
      return;
    }
    void browser.runtime.openOptionsPage().catch(error => console.error('[Unhaul] Could not open Unhaul', error));
  });
  browser.tabs.onRemoved.addListener(tabId => {
    void clearPanelSession(tabId).catch(() => console.error('[Unhaul] Panel session cleanup failed'));
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.hasOwn(changes, STORAGE_KEYS.settings)) return;
    const settings: unknown = changes[STORAGE_KEYS.settings].newValue;
    if (!isSettings(settings) || settings.consentGiven !== true) { invalidateConsentWork(); analysis.revoke(); }
  });
  const initialize = async () => {
    try {
      await initializeStorage();
    } catch (error) {
      console.error('[Unhaul] Storage initialization failed; existing data retained', error);
    }
  };
  browser.runtime.onInstalled.addListener(async details => {
    syncSites();
    try {
      await initializeStorage();
    } catch (error) {
      console.error('[Unhaul] Storage initialization failed; existing data retained', error);
      return;
    }
    if (details.reason === 'install') {
      try {
        await browser.runtime.openOptionsPage();
      } catch (error) {
        console.error('[Unhaul] Could not open the consent page', error);
      }
    }
  });
  browser.runtime.onStartup.addListener(() => { void initialize(); syncSites(); });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
    if (isPingMessage(message)) {
      sendResponse({ type: 'PONG' });
      return;
    }
    if (record(message) && message.type === 'OPEN_UNHAUL') {
      void browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#saved` });
      return;
    }
    if (record(message) && message.type === 'GET_CONSENT') {
      if (!isGetConsentMessage(message)) {
        sendResponse({ consentGiven: false } satisfies ConsentResponse);
        return;
      }
      void getSettings().then(
        settings => sendResponse({ consentGiven: settings.consentGiven === true } satisfies ConsentResponse),
        () => sendResponse({ consentGiven: false } satisfies ConsentResponse),
      );
      return true;
    }
    if (record(message) && message.type === 'IS_SITE_ENABLED') {
      const origin = sender.url ? normalizeOrigin(sender.url) : null;
      void (origin ? browser.permissions.contains({ origins: [`${origin}/*`] }) : Promise.resolve(false))
        .then(enabled => sendResponse({ type: 'SITE_ENABLED', enabled }));
      return true;
    }
    if (record(message) && message.type === 'LIST_CUSTOM_SITES') {
      void listCustomSites().then(origins => sendResponse({ type: 'CUSTOM_SITES', origins }), () => sendResponse({ type: 'CUSTOM_SITES', origins: [] }));
      return true;
    }
    if (record(message) && message.type === 'CLAIM_PANEL_OPEN') {
      if (!sender.tab || typeof message.productId !== 'string' || !message.productId.trim() || message.productId.length > 2048) {
        sendResponse({ type: 'PANEL_OPEN_PERMISSION', allowed: false });
        return;
      }
      void claimPanelOpen(sender.tab.id!, message.productId).then(
        allowed => sendResponse({ type: 'PANEL_OPEN_PERMISSION', allowed }),
        () => sendResponse({ type: 'PANEL_OPEN_PERMISSION', allowed: false }),
      );
      return true;
    }
    if (record(message) && ['PRODUCT_SEEN', 'REFINE_PRODUCT', 'ADD_TO_CART_CLICKED', 'SAVE_ITEM', 'CHECK_COOLDOWN'].includes(String(message.type))) {
      if (!isProductRequest(message)) {
        sendResponse({ type: 'ERROR', code: 'INVALID_REQUEST', message: 'Invalid product request.' } satisfies ProductOperationError);
        return;
      }
      if (message.type === 'SAVE_ITEM') {
        void saveProduct(message.product, message.wait, message.devTestWait === true).then(sendResponse, error => sendResponse({ type: 'ERROR', code: 'SAVE_FAILED', message: error instanceof Error ? error.message : 'Could not save this item. Check consent and retry.' } satisfies ProductOperationError));
        return true;
      }
      if (message.type === 'CHECK_COOLDOWN') {
        void getCooldownLock(message.product).then(result => sendResponse({ type: 'COOLDOWN_RESULT', ...result }), error => sendResponse({ type: 'ERROR', code: 'ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Could not check cooling-off lock.' }));
        return true;
      }
      if (message.type === 'PRODUCT_SEEN' || message.type === 'REFINE_PRODUCT') {
        // Per document/frame sessions reject late variants/navigation replies.
        const owner = `${sender.tab?.id ?? 'options'}:${sender.frameId ?? 0}:${sender.documentId ?? sender.url ?? ''}`;
        const task = message.type === 'PRODUCT_SEEN' ? analysis.basic(message.product, owner) : analysis.refine(message.analysisId, owner);
        // Record the visit after the analysis read history, so this visit does not count as a repeat.
        if (message.type === 'PRODUCT_SEEN') {
          const productId = message.product.productId;
          void task.then(() => recordVisit(productId)).catch(() => {});
        }
        void task.then(sendResponse, error => sendResponse({ type: 'ERROR', code: error instanceof Error && /consent/i.test(error.message) ? 'CONSENT_REQUIRED' : 'ANALYSIS_FAILED', message: 'Analysis unavailable, revoked or superseded.' } satisfies ProductOperationError));
        return true;
      }
      // ADD_TO_CART_CLICKED: the page panel handles the click itself; the background only
      // acknowledges it under consent. It never blocks or changes the store's cart.
      void beginConsentWork().then(work => {
        work.release();
        sendResponse({ type: 'OK' });
      }, () => sendResponse({ type: 'ERROR', code: 'CONSENT_REQUIRED', message: 'Consent is required for product behavior.' } satisfies ProductOperationError));
      return true;
    }
    if (!record(message) || message.type !== 'STORAGE') return;
    if (!isStorageRequest(message)) {
      sendResponse({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid storage request.' } } satisfies StorageResponse);
      return;
    }
    // Content may read settings; only options may manage local user records.
    const isOptions = sender.url?.split(/[?#]/)[0] === browser.runtime.getURL('/options.html');
    if (message.operation !== 'getSettings' && !isOptions) {
      sendResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Storage management requires the Unhaul options page.' } } satisfies StorageResponse);
      return;
    }
    void dispatchStorage(message).then(sendResponse);
    return true; // Keep the MV3 channel open until persistence/error is acknowledged.
  });
});
