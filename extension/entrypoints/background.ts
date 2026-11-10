import { browser } from 'wxt/browser';
import { isPingMessage } from '../src/shared/messages';
import { initializeStorage } from '../src/storage/repo';
import { dispatchStorage } from '../src/storage/dispatch';
import { isStorageRequest, type StorageResponse } from '../src/shared/storage-messages';
import { record } from '../src/shared/storage-validation';

export default defineBackground(() => {
  const initialize = async () => {
    try {
      await initializeStorage();
    } catch (error) {
      console.error('[Unhaul] Storage initialization failed; existing data retained', error);
    }
  };
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
  });
  browser.runtime.onStartup.addListener(initialize);

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
    if (isPingMessage(message)) {
      sendResponse({ type: 'PONG' });
      return;
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
