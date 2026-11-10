// A: implement accessible dismissal, focus handling and action callbacks.
export function createPanel(): HTMLElement {
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Unhaul reflection');
  panel.textContent = 'Saved in Unhaul does not change the store’s cart.';
  return panel;
}
