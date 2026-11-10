import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createConsentLifecycle, type ConsentScope } from '../src/consent/lifecycle';
import { isGetConsentMessage, isConsentResponse } from '../src/shared/messages';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it.each([undefined, null, false, {}, { consentGiven: false }, { consentGiven: 'true' }, { given: true }, { consentGiven: 1 }])('does not start for absent, denied or malformed response: %j', async reply => {
  const start = vi.fn();
  const gate = createConsentLifecycle({ requestConsent: async () => reply, start });
  await gate.refresh(); expect(start).not.toHaveBeenCalled(); expect(gate.isActive()).toBe(false); gate.dispose();
});
it('fails closed on rejection and a bounded timeout, ignoring late permission', async () => {
  const pending = deferred<unknown>(); const start = vi.fn();
  const requestConsent = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockReturnValueOnce(pending.promise);
  const gate = createConsentLifecycle({ requestConsent, start, timeoutMs: 100 });
  await gate.refresh(); expect(start).not.toHaveBeenCalled();
  const refresh = gate.refresh(); await vi.advanceTimersByTimeAsync(100); await refresh;
  pending.resolve({ consentGiven: true }); await Promise.resolve();
  expect(start).not.toHaveBeenCalled(); gate.dispose();
});
it('starts once for concurrent and repeated refreshes after literal true', async () => {
  const start = vi.fn(); const requestConsent = vi.fn().mockResolvedValue({ consentGiven: true });
  const gate = createConsentLifecycle({ requestConsent, start });
  await Promise.all([gate.refresh(), gate.refresh()]); await gate.refresh();
  expect(start).toHaveBeenCalledTimes(1); expect(requestConsent).toHaveBeenCalledTimes(1); gate.dispose();
});
it('cleans UI, observers and event resources through registered callbacks and aborts requests', async () => {
  let scope!: ConsentScope;
  const removeUI = vi.fn(); const disconnect = vi.fn(); const removeEvents = vi.fn();
  const gate = createConsentLifecycle({ requestConsent: async () => ({ consentGiven: true }), start: current => {
    scope = current; current.onCleanup(removeUI); current.onCleanup(disconnect); current.onCleanup(removeEvents);
  } });
  await gate.refresh(); gate.revoke(); gate.revoke();
  expect(scope.signal.aborted).toBe(true); expect(scope.isCurrent()).toBe(false); expect(gate.isActive()).toBe(false);
  for (const cleanup of [removeUI, disconnect, removeEvents]) expect(cleanup).toHaveBeenCalledTimes(1);
  const lateCleanup = vi.fn(); scope.onCleanup(lateCleanup); expect(lateCleanup).toHaveBeenCalledTimes(1); gate.dispose();
});
it('discards consent replies after revocation and can safely start on later agreement', async () => {
  const old = deferred<unknown>(); const start = vi.fn();
  const requestConsent = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ consentGiven: true });
  const gate = createConsentLifecycle({ requestConsent, start });
  const initial = gate.refresh(); await Promise.resolve(); gate.revoke();
  await gate.refresh(); old.resolve({ consentGiven: true }); await initial;
  expect(start).toHaveBeenCalledTimes(1); gate.dispose();
});
it('invalidates an asynchronous start and immediately cleans resources registered late', async () => {
  const finish = deferred<void>(); let scope!: ConsentScope; const cleanup = vi.fn();
  const gate = createConsentLifecycle({ requestConsent: async () => ({ consentGiven: true }), start: async current => {
    scope = current; await finish.promise; current.onCleanup(cleanup);
  } });
  const refresh = gate.refresh(); await vi.advanceTimersByTimeAsync(0);
  gate.dispose(); finish.resolve(); await refresh;
  expect(scope.isCurrent()).toBe(false); expect(cleanup).toHaveBeenCalledTimes(1);
  await gate.refresh(); expect(gate.isActive()).toBe(false);
});
it('validates the consent request and response contracts', () => {
  expect(isGetConsentMessage({ type: 'GET_CONSENT' })).toBe(true);
  expect(isGetConsentMessage({ type: 'GET_CONSENT', consentGiven: true })).toBe(false);
  expect(isConsentResponse({ consentGiven: true })).toBe(true);
  expect(isConsentResponse({ consentGiven: 'true' })).toBe(false);
});
