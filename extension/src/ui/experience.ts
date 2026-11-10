import type { ConsentScope } from '../consent/lifecycle';
import type { AnalysisResult, Product, SaveResult } from '../shared/types';
import type { WaitKey } from '../shared/lists';
import { extractProduct } from '../store/extract';
import { createBadge, updateBadge } from './badge';
import { createPanel } from './panel';
import { REFLECTION_STYLES } from './styles';
import { savedProductIdentity } from '../shared/cooling';
interface Dependencies {
  scope: ConsentScope;
  analyze(product: Product, publish: (analysis: AnalysisResult) => void, signal: AbortSignal): Promise<void>;
  cancelAnalysis(): void;
  saveProduct?(product: Product, wait: WaitKey, devTestWait?: boolean): Promise<SaveResult>;
  claimAutoOpen(productId: string): Promise<boolean>;
  checkCooldown?(product: Product): Promise<{ locked: boolean; reconsiderAt?: number; remainingLabel?: string }>;
  document?: Document;
  readProduct?: () => Product | null;
}
/** Uses no storage/network directly. All mounted resources belong to the consent scope. */
export function mountReflectionExperience(deps: Dependencies) {
  const doc = deps.document ?? document;
  const win = doc.defaultView!;
  let host: HTMLElement | undefined;
  let root: ShadowRoot | undefined;
  let badge: HTMLButtonElement | undefined;
  let panel: ReturnType<typeof createPanel> | undefined;
  let product: Product | null = null;
  let analysis: AnalysisResult | null = null;
  let fingerprint = '';
  let lastURL = doc.location.href;
  let generation = 0;
  let stopped = false;
  let previousFocus: HTMLElement | null = null;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let claiming = false;
  let lastSource = '';
  let waitingForSource: string | undefined;
  const cooldown = new Map<string, { locked: boolean; reconsiderAt?: number; remainingLabel?: string }>();
  const unlocked = new Set<string>();
  const sourceSignature = () => JSON.stringify([
    ...[...doc.querySelectorAll('script[type="application/ld+json"]')].map(node => node.textContent),
    ...[...doc.querySelectorAll('meta[property^="og:"], meta[property^="product:"]')].map(node => node.getAttribute('content')),
  ]);
  const read = deps.readProduct ?? (() => extractProduct(doc));
  const active = () => !stopped && deps.scope.isCurrent();
  function close(): void {
    if (!panel || panel.element.hidden) return;
    panel.element.hidden = true; badge?.setAttribute('aria-expanded', 'false');
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function open(): void {
    if (doc.location.href !== lastURL) { navigation(); return; }
    if (!active() || !panel || !product || !panel.element.hidden) return;
    const focused = root?.activeElement ?? doc.activeElement;
    previousFocus = focused instanceof HTMLElement ? focused : null;
    panel.element.hidden = false; badge?.setAttribute('aria-expanded', 'true'); panel.closeButton.focus({ preventScroll: true });
  }
  function removeView(): void {
    panel?.dispose(); host?.remove(); host = undefined; root = undefined; panel = undefined; badge = undefined;
  }
  function ensureView(): void {
    if (!active()) return;
    if (host) { if (!host.isConnected && doc.body) doc.body.append(host); return; }
    host = doc.createElement('div'); host.dataset.unhaulRoot = '';
    root = host.attachShadow({ mode: 'closed' });
    const style = doc.createElement('style'); style.textContent = REFLECTION_STYLES;
    const shell = doc.createElement('div'); shell.className = 'shell';
    badge = createBadge(); badge.setAttribute('aria-expanded', 'false');
    badge.addEventListener('click', open);
    panel = createPanel(close, deps.saveProduct && (async (item, wait, devTestWait) => {
      const result = await deps.saveProduct!(item, wait, devTestWait);
      void refreshCooldown(item);
      return result;
    }), () => {
      if (product) unlocked.add(savedProductIdentity(product));
    });
    shell.append(badge, panel.element); root.append(style, shell);
    doc.body?.append(host);
  }
  async function refreshCooldown(item: Product): Promise<void> {
    if (!deps.checkCooldown) return;
    try {
      const result = await deps.checkCooldown(item);
      const identity = savedProductIdentity(item);
      cooldown.set(identity, result);
      if (product && savedProductIdentity(product) === identity && panel && !unlocked.has(identity)) {
        panel.update(item, analysis, false, result);
      }
    } catch { /* Fail open when the optional lock cannot be checked. */ }
  }
  function reset(): void {
    generation++; deps.cancelAnalysis(); analysis = null; fingerprint = ''; product = null; claiming = false; removeView();
  }
  function update(): void {
    if (!active()) return;
    const source = sourceSignature();
    if (waitingForSource !== undefined && source === waitingForSource) return;
    waitingForSource = undefined;
    let next: Product | null;
    try { next = read(); } catch { next = null; }
    if (!next) { if (product) reset(); return; }
    const signature = JSON.stringify(next);
    if (signature === fingerprint) { ensureView(); return; }
    generation++; deps.cancelAnalysis(); claiming = false;
    const current = generation;
    const stillCurrent = () => {
      if (!active() || current !== generation || doc.location.href !== next!.url) return false;
      try { return JSON.stringify(read()) === signature; } catch { return false; }
    };
    fingerprint = signature; product = next; analysis = null; lastSource = source;
    ensureView(); if (!badge || !panel) return;
    cooldown.delete(savedProductIdentity(next)); unlocked.delete(savedProductIdentity(next));
    updateBadge(badge, { state: 'loading' }); panel.update(next, null, false);
    void refreshCooldown(next);
    void deps.analyze(next, result => {
      if (!stillCurrent() || result.productId !== next.productId) return;
      analysis = result;
      updateBadge(badge!, { state: 'ready', count: result.totalMatches }); panel!.update(next, result, false);
    }, deps.scope.signal).catch(() => {
      if (!stillCurrent() || analysis) return;
      updateBadge(badge!, { state: 'error' }); panel!.update(next, null, true);
    });
  }
  function schedule(): void {
    if (!active()) return;
    if (debounce !== undefined) return;
    debounce = setTimeout(() => { debounce = undefined; update(); }, 120);
  }
  function navigation(): void {
    if (!active() || doc.location.href === lastURL) return;
    if (new URL(lastURL).pathname !== new URL(doc.location.href).pathname && product) waitingForSource = lastSource;
    lastURL = doc.location.href;
    reset(); // Immediately discard old analysis/UI before new page data settles.
    schedule();
  }
  function cartLabel(element: Element): boolean {
    const text = [element.getAttribute('aria-label'), element.getAttribute('name'), element.getAttribute('value'), element.textContent].filter(Boolean).join(' ');
    return /\b(?:add\s+to\s+(?:cart|bag)|buy\s+now)\b/i.test(text);
  }
  function onShopping(event: Event): void {
    navigation();
    if (!active() || !product || !panel || claiming || event.composedPath().includes(host!)) return;
    const target = event.type === 'submit' ? (event as SubmitEvent).submitter
      : event.composedPath().find(node => node instanceof Element && node.matches('button, input[type="submit"], input[type="button"], [role="button"]'));
    if (!(target instanceof Element) || !cartLabel(target) || ('disabled' in target && target.disabled)) return;
    const current = generation;
    const id = product.productId;
    const identity = savedProductIdentity(product);
    const lock = cooldown.get(identity);
    if (lock?.locked === true && !unlocked.has(identity)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      panel.update(product, analysis, false, lock);
      open();
      return;
    }
    const location = doc.location.href;
    claiming = true;
    // When the opt-in cooling-off lock is off, this remains intent-only and never cancels the merchant event.
    void deps.claimAutoOpen(id).then(allowed => {
      if (allowed && active() && current === generation && product?.productId === id && doc.location.href === location) open();
    }).catch(() => { /* Manual opening stays available when session persistence fails. */ })
      .finally(() => { if (current === generation) claiming = false; });
  }
  const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.target !== host)) { navigation(); schedule(); }
  });
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['content', 'value'] });
  doc.addEventListener('keydown', onEscape, true);
  doc.addEventListener('click', onShopping, true); doc.addEventListener('submit', onShopping, true);
  doc.addEventListener('change', schedule, true); doc.addEventListener('input', schedule, true);
  win.addEventListener('popstate', navigation); win.addEventListener('hashchange', navigation);
  // Works across isolated/main-world history calls without monkeypatching merchant history.
  const poll = setInterval(navigation, 400);
  function dispose(): void {
    if (stopped) return;
    stopped = true; generation++; clearTimeout(debounce); clearInterval(poll); observer.disconnect();
    deps.cancelAnalysis(); doc.removeEventListener('keydown', onEscape, true); doc.removeEventListener('click', onShopping, true); doc.removeEventListener('submit', onShopping, true);
    doc.removeEventListener('change', schedule, true); doc.removeEventListener('input', schedule, true);
    win.removeEventListener('popstate', navigation); win.removeEventListener('hashchange', navigation); removeView();
  }
  deps.scope.onCleanup(dispose);
  if (active()) update(); else dispose();
  return { dispose, open, close, refresh: update, get root() { return root; } };
}
