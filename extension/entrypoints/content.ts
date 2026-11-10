import { browser } from 'wxt/browser';
import { isPongMessage } from '../src/shared/messages';
import { isSettings } from '../src/shared/storage-validation';
import { STORAGE_KEYS } from '../src/storage/keys';
import { createConsentLifecycle } from '../src/consent/lifecycle';

export default defineContentScript({
  matches: ['https://www.daraz.pk/products/*'],
  async main(ctx) {
    const gate = createConsentLifecycle({
      requestConsent: () => browser.runtime.sendMessage({ type: 'GET_CONSENT' }),
      async start(scope) {
        // Preserve the existing connectivity check only; product behavior is not implemented.
        // Future UI/observers/listeners register cleanup through scope.onCleanup;
        // fetch uses scope.signal and every async continuation checks scope.isCurrent().
        try {
          const reply: unknown = await browser.runtime.sendMessage({ type: 'PING' });
          if (!scope.isCurrent()) return;
          if (!isPongMessage(reply)) throw new Error('Unexpected background response');
          console.info('[Unhaul] PONG');
        } catch (error) {
          if (scope.isCurrent()) console.error('[Unhaul] Background connection failed', error);
          throw error;
        }
      },
    });
    const onChange: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'local' || !Object.hasOwn(changes, STORAGE_KEYS.settings)) return;
      gate.revoke();
      const settings: unknown = changes[STORAGE_KEYS.settings].newValue;
      if (isSettings(settings) && settings.consentGiven === true) void gate.refresh();
    };
    browser.storage.onChanged.addListener(onChange);
    ctx.onInvalidated(() => {
      gate.dispose();
      browser.storage.onChanged.removeListener(onChange);
    });
    await gate.refresh();
  },
});
