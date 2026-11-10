import { isConsentResponse } from '../shared/messages';
export interface ConsentScope {
  signal: AbortSignal;
  isCurrent(): boolean;
  onCleanup(cleanup: () => void): void;
}
interface Dependencies {
  requestConsent(): Promise<unknown>;
  start(scope: ConsentScope): Promise<void> | void;
  timeoutMs?: number;
}
/** Content-side gate. Does not extract products, observe pages or create shopping UI. */
export function createConsentLifecycle(deps: Dependencies) {
  let disposed = false;
  let active = false;
  let epoch = 0;
  let controller: AbortController | undefined;
  let pending: Promise<void> | undefined;
  const cleanups = new Set<() => void>();
  function stop(): void {
    active = false;
    epoch++;
    controller?.abort();
    controller = undefined;
    pending = undefined;
    for (const cleanup of cleanups) {
      try { cleanup(); } catch (error) { console.error('[Unhaul] Consent cleanup failed', error); }
    }
    cleanups.clear();
  }
  function refresh(): Promise<void> {
    if (disposed || active) return Promise.resolve();
    if (pending) return pending;
    const current = ++epoch;
    const run = new AbortController();
    controller = run;
    let timer: ReturnType<typeof setTimeout>;
    const denied = new Promise<undefined>(resolve => {
      run.signal.addEventListener('abort', () => resolve(undefined), { once: true });
      timer = setTimeout(() => { run.abort(); resolve(undefined); }, deps.timeoutMs ?? 3000);
    });
    // runtime.sendMessage cannot be physically cancelled. Abort/epoch checks discard its late reply.
    const consent = Promise.resolve().then(deps.requestConsent).catch(() => undefined);
    const task = (async () => {
      try {
        const reply = await Promise.race([consent, denied]);
        clearTimeout(timer!);
        if (disposed || current !== epoch || run.signal.aborted || !isConsentResponse(reply) || reply.consentGiven !== true) return;
        active = true;
        const scope: ConsentScope = {
          signal: run.signal,
          isCurrent: () => !disposed && active && current === epoch && !run.signal.aborted,
          onCleanup: cleanup => {
            if (scope.isCurrent()) cleanups.add(cleanup);
            else cleanup();
          },
        };
        try { await deps.start(scope); }
        catch { if (current === epoch) stop(); }
      } finally {
        clearTimeout(timer!);
        if (current === epoch) pending = undefined;
      }
    })();
    pending = task;
    return task;
  }
  return {
    refresh,
    revoke: stop,
    dispose() { if (!disposed) { disposed = true; stop(); } },
    isActive: () => active && !disposed,
  };
}
