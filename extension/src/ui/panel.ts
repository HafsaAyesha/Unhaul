import type { AnalysisResult, Product } from '../shared/types';
import { choosePrompt } from '../match/prompts';
export interface PanelView {
  element: HTMLElement;
  closeButton: HTMLButtonElement;
  update(product: Product, analysis: AnalysisResult | null, error: boolean): void;
}
export function createPanel(onClose: () => void): PanelView {
  const panel = document.createElement('section');
  panel.className = 'panel'; panel.hidden = true; panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'unhaul-heading');
  const header = document.createElement('header');
  const heading = document.createElement('h2'); heading.id = 'unhaul-heading'; heading.textContent = 'A moment to reconsider';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss Unhaul'); close.addEventListener('click', onClose);
  header.append(heading, close);
  const title = document.createElement('h3');
  const price = document.createElement('p');
  const image = document.createElement('img'); image.alt = ''; image.referrerPolicy = 'no-referrer'; image.crossOrigin = 'anonymous'; image.loading = 'lazy';
  image.addEventListener('error', () => { image.hidden = true; });
  const state = document.createElement('p'); state.setAttribute('role', 'status');
  const matches = document.createElement('ul');
  const question = document.createElement('p'); question.className = 'question';
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save for later'; save.disabled = true; save.setAttribute('aria-describedby', 'unhaul-save-note');
  const saveNote = document.createElement('p'); saveNote.id = 'unhaul-save-note'; saveNote.textContent = 'Save for later is not available in this build yet. Nothing will be saved.';
  const continueButton = document.createElement('button'); continueButton.type = 'button'; continueButton.textContent = 'Continue shopping'; continueButton.addEventListener('click', onClose);
  const cartNote = document.createElement('p'); cartNote.className = 'muted'; cartNote.textContent = 'Unhaul does not change the store’s cart, reserve stock or lock prices.';
  panel.append(header, title, price, image, state, matches, question, save, continueButton, saveNote, cartNote);
  return {
    element: panel, closeButton: close,
    update(product, analysis, error) {
      title.textContent = product.title;
      if (product.price !== null && product.currency) {
        try { price.textContent = new Intl.NumberFormat('en-PK', { style: 'currency', currency: product.currency }).format(product.price); }
        catch { price.textContent = `${product.currency} ${product.price}`; }
      } else price.textContent = 'Price unavailable';
      if (product.imageUrl) {
        // Reader validates URLs; still check before assigning a resource attribute.
        try {
          const url = new URL(product.imageUrl);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid image');
          if (image.getAttribute('src') !== url.href) image.src = url.href;
          image.hidden = false;
        } catch { image.removeAttribute('src'); image.hidden = true; }
      } else { image.removeAttribute('src'); image.hidden = true; }
      state.textContent = error ? 'Analysis is unavailable. You can still take a moment to reflect.'
        : !analysis ? 'Checking your items…' : analysis.totalMatches ? `${analysis.totalMatches} similar item(s) in My Items.` : 'No reliable match found in My Items.';
      const rows = (analysis?.matches ?? []).slice(0, 3).map(match => {
        const row = document.createElement('li'); row.textContent = `${match.item.name} — ${match.reason}`; return row;
      });
      matches.replaceChildren(...rows);
      question.textContent = choosePrompt(analysis?.totalMatches ?? 0, product, analysis?.repeatVisit === true);
    },
  };
}
