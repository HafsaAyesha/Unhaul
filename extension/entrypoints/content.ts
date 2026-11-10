import { browser } from 'wxt/browser';
import { isPongMessage } from '../src/shared/messages';

export default defineContentScript({
  matches: ['https://www.daraz.pk/products/*'],
  async main() {
    // Connectivity check only. No product data or browsing history is collected.
    try {
      const reply: unknown = await browser.runtime.sendMessage({ type: 'PING' });
      if (!isPongMessage(reply)) throw new Error('Unexpected background response');
      console.info('[Unhaul] PONG');
    } catch (error) {
      console.error('[Unhaul] Background connection failed', error);
    }
  },
});
