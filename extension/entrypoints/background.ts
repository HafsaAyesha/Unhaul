import { browser } from 'wxt/browser';
<<<<<<< HEAD
<<<<<<< HEAD
=======
import { createAnalysisService } from '../src/classify/analysis';
>>>>>>> 2af525da18ce24d9afafd49b6aba7ae3e6b8fb65
import { isPingMessage, isGetConsentMessage, isProductRequest, type ConsentResponse, type ProductOperationError } from '../src/shared/messages';
import { initializeStorage, getSettings, beginConsentWork, claimPanelOpen, clearPanelSession } from '../src/storage/repo';
import { invalidateConsentWork } from '../src/consent/work';
import { STORAGE_KEYS } from '../src/storage/keys';
import { isSettings } from '../src/shared/storage-validation';
=======
import { isPingMessage } from '../src/shared/messages';
import { initializeStorage, recordVisit, rescheduleReminders, handleSavedAlarm, upsertSaved, waitDeadline, getSettings } from '../src/storage/repo';
>>>>>>> 38a0ce5 (cleaning)
import { dispatchStorage } from '../src/storage/dispatch';
import { isStorageRequest, type StorageResponse } from '../src/shared/storage-messages';
import { isProduct, record } from '../src/shared/storage-validation';
import type { Product } from '../src/shared/types';

export default defineBackground(() => {
  const analysis = createAnalysisService();
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
      await rescheduleReminders();
    } catch (error) {
      console.error('[Unhaul] Storage initialization failed; existing data retained', error);
    }
  };
<<<<<<< HEAD
  browser.runtime.onInstalled.addListener(async details => {
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
=======
  browser.runtime.onInstalled.addListener(details => {
    void initialize();
    if (details?.reason === 'install') void browser.runtime.openOptionsPage?.();
>>>>>>> 38a0ce5 (cleaning)
  });
  browser.runtime.onStartup.addListener(initialize);
  browser.alarms?.onAlarm?.addListener(alarm => { void handleSavedAlarm(alarm.name); });

  function parseWait(value: unknown): 1 | 3 | 7 | null {
    if (value === 'none' || value === null) return null;
    if (value === 1 || value === '24h') return 1;
    if (value === 3 || value === '3d') return 3;
    if (value === 7 || value === '7d') return 7;
    return 1;
  }
  async function saveItem(product: Product, wait: 1 | 3 | 7 | null) {
    const savedAt = Date.now();
    const deadline = waitDeadline(savedAt, wait);
    return upsertSaved({
      id: product.id, product, savedAt, reconsiderAt: deadline ?? savedAt, deadline, status: 'waiting',
    });
  }

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
    if (isPingMessage(message)) {
      sendResponse({ type: 'PONG' });
      return;
    }
    if (record(message) && message.type === 'GET_CONSENT') {
<<<<<<< HEAD
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
    if (record(message) && ['PRODUCT_SEEN', 'REFINE_PRODUCT', 'ADD_TO_CART_CLICKED', 'SAVE_ITEM'].includes(String(message.type))) {
      if (!isProductRequest(message)) {
        sendResponse({ type: 'ERROR', code: 'INVALID_REQUEST', message: 'Invalid product request.' } satisfies ProductOperationError);
        return;
      }
      if (message.type === 'PRODUCT_SEEN' || message.type === 'REFINE_PRODUCT') {
        // Per document/frame sessions reject late variants/navigation replies.
        const owner = `${sender.tab?.id ?? 'options'}:${sender.frameId ?? 0}:${sender.documentId ?? sender.url ?? ''}`;
        const task = message.type === 'PRODUCT_SEEN' ? analysis.basic(message.product, owner) : analysis.refine(message.analysisId, owner);
        void task.then(sendResponse, error => sendResponse({ type: 'ERROR', code: error instanceof Error && /consent/i.test(error.message) ? 'CONSENT_REQUIRED' : 'ANALYSIS_FAILED', message: 'Analysis unavailable, revoked or superseded.' } satisfies ProductOperationError));
        return true;
      }
      void beginConsentWork().then(work => {
        // Product extraction/visits/classification handlers are unfinished. Future work
        // must retain this scope, pass its signal to fetch, reverify, and commit with it.
        work.release();
        sendResponse({ type: 'ERROR', code: 'NOT_IMPLEMENTED', message: 'Product behavior is not implemented yet.' } satisfies ProductOperationError);
      }, () => sendResponse({ type: 'ERROR', code: 'CONSENT_REQUIRED', message: 'Consent is required for product behavior.' } satisfies ProductOperationError));
=======
      void getSettings().then(settings => sendResponse({ type: 'CONSENT', consentGiven: settings.consentGiven }));
      return true;
    }
    if (record(message) && message.type === 'PRODUCT_SEEN' && typeof message.productId === 'string') {
      void recordVisit(message.productId).then(() => sendResponse({ type: 'OK' }));
      return true;
    }
    if (record(message) && (message.type === 'SAVE_ITEM' || message.type === 'SAVE_FOR_LATER') && isProduct(message.product)) {
      const wait = parseWait(message.wait ?? message.waitDays);
      void saveItem(message.product, wait).then(({ result, deadline }) => {
        sendResponse({ type: 'SAVE_RESULT', result, deadline });
      });
>>>>>>> 38a0ce5 (cleaning)
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
