import type { AnalysisResult, Product, SaveResult } from '../shared/types';
import { WAITS, WAIT_LABELS, type WaitKey } from '../shared/lists';
import { choosePrompt } from '../match/prompts';
import { formatPrice } from './price';
export interface PanelView {
  element: HTMLElement;
  closeButton: HTMLButtonElement;
  dispose(): void;
  update(product: Product, analysis: AnalysisResult | null, error: boolean): void;
}
const DEV_TEST_OPTION = 'dev-1m';
export function createPanel(onClose: () => void, saveProduct?: (product: Product, wait: WaitKey, devTestWait?: boolean) => Promise<SaveResult>): PanelView {
  let currentProduct: Product | null = null;
  let productSignature = '';
  let revision = 0;
  let saving = false;
  let disposed = false;
  const panel = document.createElement('section');
  panel.className = 'panel'; panel.hidden = true; panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'unhaul-heading');
  const header = document.createElement('header');
  const headingGroup = document.createElement('div');
  const brand = document.createElement('small'); brand.textContent = 'Unhaul';
  const heading = document.createElement('h2'); heading.id = 'unhaul-heading'; heading.textContent = 'A moment to reconsider';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss Unhaul'); close.addEventListener('click', onClose);
  headingGroup.append(brand, heading); header.append(headingGroup, close);
  const product = document.createElement('div'); product.className = 'product';
  const productVisual = document.createElement('div'); productVisual.className = 'product-visual';
  const productInfo = document.createElement('div'); productInfo.className = 'product-info';
  const title = document.createElement('h3');
  const price = document.createElement('p');
  const image = document.createElement('img'); image.alt = ''; image.referrerPolicy = 'no-referrer'; image.crossOrigin = 'anonymous'; image.loading = 'lazy';
  image.addEventListener('error', () => { image.hidden = true; });
  productVisual.append(image); productInfo.append(title, price); product.append(productVisual, productInfo);
  const state = document.createElement('p'); state.setAttribute('role', 'status');
  const matches = document.createElement('ul'); matches.className = 'matches';
  const basic = document.createElement('p'); basic.className = 'muted'; basic.textContent = 'Basic matching'; basic.hidden = true;
  const question = document.createElement('p'); question.className = 'question';
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save for later'; save.disabled = !saveProduct; save.setAttribute('aria-describedby', 'unhaul-save-note');
  const durationLabel = document.createElement('label'); durationLabel.textContent = 'Reconsider after '; durationLabel.htmlFor = 'unhaul-duration';
  const duration = document.createElement('select'); duration.id = 'unhaul-duration';
  for (const key of Object.keys(WAITS) as WaitKey[]) {
    const option = document.createElement('option'); option.value = key; option.textContent = WAIT_LABELS[key]; duration.append(option);
  }
  // Dev builds only: a 1-minute wait for testing Ready and restarts. Not in WAITS, absent from production.
  if (import.meta.env.DEV) {
    const option = document.createElement('option'); option.value = DEV_TEST_OPTION; option.textContent = '1 minute (dev test)'; duration.append(option);
  }
  durationLabel.append(duration);
  const saveNote = document.createElement('p'); saveNote.id = 'unhaul-save-note'; saveNote.setAttribute('role', 'status'); saveNote.textContent = saveProduct ? '' : 'Save for later is not available in this build yet. Nothing will be saved.';
  save.addEventListener('click', async () => {
    if (!saveProduct || !currentProduct || saving || disposed) return;
    const current = revision;
    const snapshot = structuredClone(currentProduct);
    const devTestWait = import.meta.env.DEV && duration.value === DEV_TEST_OPTION;
    const wait = (devTestWait ? '24h' : duration.value) as WaitKey;
    saving = true; save.disabled = true; duration.disabled = true; save.textContent = 'Saving…';
    saveNote.setAttribute('role', 'status'); saveNote.textContent = 'Saving in Unhaul…';
    try {
      const result = devTestWait ? await saveProduct(snapshot, wait, true) : await saveProduct(snapshot, wait);
      if (disposed || current !== revision) return;
      saveNote.textContent = result.result === 'already_saved'
        ? 'Already saved in Unhaul. Your original deadline is unchanged. This does not change the store’s cart.'
        : 'Saved in Unhaul. This does not change the store’s cart.';
    } catch (error) {
      if (!disposed && current === revision) {
        saveNote.setAttribute('role', 'alert');
        saveNote.textContent = error instanceof Error ? error.message : 'Could not save. Please retry.';
      }
    } finally {
      if (!disposed && current === revision) { saving = false; save.disabled = false; duration.disabled = false; save.textContent = 'Save for later'; }
    }
  });
  const continueButton = document.createElement('button'); continueButton.type = 'button'; continueButton.textContent = 'Continue shopping'; continueButton.addEventListener('click', onClose);
  const cartNote = document.createElement('p'); cartNote.className = 'muted'; cartNote.textContent = 'Unhaul does not change the store’s cart, reserve stock or lock prices.';
  const saveAction = document.createElement('div'); saveAction.className = 'save-action'; saveAction.append(save, durationLabel);
  const actions = document.createElement('div'); actions.className = 'actions'; actions.append(saveAction, continueButton);
  panel.append(header, product, state, question, matches, basic, actions, saveNote, cartNote);
  return {
    element: panel, closeButton: close,
    dispose() { disposed = true; revision++; },
    update(product, analysis, error) {
      const signature = JSON.stringify(product);
      if (signature !== productSignature) {
        revision++; productSignature = signature; currentProduct = structuredClone(product); saving = false;
        save.disabled = !saveProduct; duration.disabled = false; save.textContent = 'Save for later';
        if (saveProduct) saveNote.textContent = '';
      }
      title.textContent = product.title;
      price.textContent = formatPrice(product.price, product.currency);
      price.hidden = !price.textContent;
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
        const row = document.createElement('li');
        const owned = document.createElement('span'); owned.textContent = `You already own: ${match.item.name}`;
        const reason = document.createElement('span'); reason.className = 'muted'; reason.textContent = match.reason;
        row.append(owned, reason); return row;
      });
      matches.replaceChildren(...rows);
      // Keyword results (no AI yet, or AI unavailable) are labelled so the user knows they are basic.
      basic.hidden = !analysis || (analysis.phase !== 'basic' && analysis.phase !== 'fallback') || analysis.classification.source !== 'keywords';
      question.textContent = choosePrompt(analysis?.totalMatches ?? 0, product, analysis?.repeatVisit === true);
    },
  };
}
