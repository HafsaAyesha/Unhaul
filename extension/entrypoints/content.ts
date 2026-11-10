import { browser } from 'wxt/browser';
import { send, isPongMessage } from '../src/shared/messages';
import { isSettings } from '../src/shared/storage-validation';
import { STORAGE_KEYS } from '../src/storage/keys';
import { createConsentLifecycle } from '../src/consent/lifecycle';
import { createAnalysisClient } from '../src/classify/client';
import { mountReflectionExperience } from '../src/ui/experience';

export default defineContentScript({
  matches: ['https://www.daraz.pk/products/*'],
  async main(ctx) {
    const gate = createConsentLifecycle({
      requestConsent: () => browser.runtime.sendMessage({ type: 'GET_CONSENT' }),
      async start(scope) {
        // Product observers/UI are created only after the consent gate grants a scope.
        if (typeof document !== 'undefined') {
          const client = createAnalysisClient();
          mountReflectionExperience({ scope, analyze: client.analyze, cancelAnalysis: client.cancel,
            claimAutoOpen: async productId => (await send({ type: 'CLAIM_PANEL_OPEN', productId })).allowed });
        }
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
