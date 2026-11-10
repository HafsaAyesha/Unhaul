import { browser } from 'wxt/browser';
import { isPingMessage } from '../src/shared/messages';
import { initializeStorage } from '../src/storage/repo';

export default defineBackground(() => {
  const initialize = async () => {
    try {
      await initializeStorage();
    } catch (error) {
      console.error('[Unhaul] Storage initialization failed; existing data retained', error);
    }
  };
  browser.runtime.onInstalled.addListener(initialize);
  browser.runtime.onStartup.addListener(initialize);

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !isPingMessage(message)) return;
    sendResponse({ type: 'PONG' });
  });
});
