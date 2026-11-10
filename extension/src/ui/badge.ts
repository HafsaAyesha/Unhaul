export type BadgeState = { state: 'loading' } | { state: 'error' } | { state: 'ready'; count: number };
export function createBadge(initial: number | BadgeState = { state: 'loading' }): HTMLButtonElement {
  const badge = document.createElement('button');
  badge.type = 'button'; badge.className = 'badge'; badge.setAttribute('aria-haspopup', 'dialog');
  updateBadge(badge, typeof initial === 'number' ? { state: 'ready', count: initial } : initial);
  return badge;
}
export function updateBadge(badge: HTMLButtonElement, state: BadgeState): void {
  badge.textContent = state.state === 'loading' ? 'Unhaul · checking…' : state.state === 'error' ? 'Unhaul · analysis unavailable' : state.count ? `Unhaul · ${state.count} similar ${state.count === 1 ? 'item' : 'items'} you own` : 'Unhaul · pause before buying';
  badge.setAttribute('aria-label', `${badge.textContent}. Open reflection panel.`);
}
