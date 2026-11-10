import { browser } from 'wxt/browser';
import { isPingMessage } from '../src/shared/messages';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !isPingMessage(message)) return;
    sendResponse({ type: 'PONG' });
  });
});
