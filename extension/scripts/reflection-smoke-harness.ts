// Synthetic browser harness only; never an extension entrypoint or production global.
import { mountReflectionExperience } from '../src/ui/experience';
import { classifyKeywords } from '../src/classify/keywords';
import { findMatches } from '../src/match/match';
import { sampleItems } from '../src/storage/sample-items';
import { extractProduct } from '../src/store/extract';
import { choosePrompt } from '../src/match/prompts';
import { createSavedList } from '../entrypoints/options/saved-list';
import { WAITS, type WaitKey } from '../src/shared/lists';
import type { SavedItem, SaveResult } from '../src/shared/types';
import type { AnalysisResult, Product } from '../src/shared/types';
export function start(enableSaving = false) {
  let savedRecords: SavedItem[] = [];
  let pendingSave: { product: Product; wait: WaitKey; resolve: (value: SaveResult) => void; reject: (reason: Error) => void } | undefined;
  let list: ReturnType<typeof createSavedList> | undefined;
  let active = true; const abort = new AbortController(); const cleanup: (() => void)[] = [];
  const claimed = new Set<string>();
  const deferred: (() => void)[] = [];
  let analyses = 0; let claims = 0;
  const scope = { signal: abort.signal, isCurrent: () => active, onCleanup: (fn: () => void) => { cleanup.push(fn); } };
  const experience = mountReflectionExperience({ scope, cancelAnalysis() {},
    saveProduct: enableSaving ? (product, wait) => new Promise<SaveResult>((resolve, reject) => { pendingSave = { product, wait, resolve, reject }; }) : undefined,
    claimAutoOpen: async id => { claims++; if (claimed.has(id)) return false; claimed.add(id); return true; },
    async analyze(product, publish) {
      analyses++;
      if (product.title.startsWith('Broken')) throw new Error('Synthetic failure');
      const classification = classifyKeywords(product.title);
      const summary = findMatches(classification, [...sampleItems, { ...sampleItems[0], id: 'unsafe-name', name: '<img src=x onerror="window.injected=1">' }]);
      const result: AnalysisResult = { type: 'MATCH_RESULT', analysisId: product.productId, productId: product.productId,
        classification, ...summary, question: choosePrompt(summary.totalMatches, product), repeatVisit: false, phase: 'basic', refinementAvailable: false };
      if (product.title.startsWith('Slow')) await new Promise<void>(resolve => deferred.push(() => { publish(result); resolve(); }));
      else publish(result);
    },
  });
  return {
    get root() { return experience.root; }, get analyses() { return analyses; }, get claims() { return claims; },
    completeSave(fail = false) {
      if (!pendingSave) throw new Error('No pending synthetic save');
      const pending = pendingSave; pendingSave = undefined;
      if (fail) { pending.reject(new Error('Synthetic save failure. Please retry.')); return; }
      const savedAt = Date.now(); const deadline = savedAt + WAITS[pending.wait];
      const record: SavedItem = { id: 'synthetic-save', product: pending.product, wait: pending.wait, savedAt, deadline, reconsiderAt: deadline, status: 'waiting' };
      savedRecords = [record]; pending.resolve({ type: 'SAVE_RESULT', result: 'saved', deadline, record });
    },
    mountList() {
      const root = document.createElement('div'); root.id = 'synthetic-saved-list'; document.body.append(root);
      list = createSavedList(root, {
        getSavedItems: async () => structuredClone(savedRecords),
        decideSavedItem: async (id, status) => {
          savedRecords = savedRecords.map(item => item.id === id ? { ...item, status, decidedAt: Date.now() } : item);
          return savedRecords.find(item => item.id === id)!;
        },
      });
      cleanup.push(() => { list?.dispose(); root.remove(); }); list.setEnabled(true);
    },
    async expire() {
      const deadline = Date.now() - 1;
      savedRecords = savedRecords.map(item => ({ ...item, savedAt: deadline - 1000, deadline, reconsiderAt: deadline }));
      await list?.refresh();
    },
    async clearSaved() { savedRecords = []; await list?.refresh(); },
    read: () => extractProduct(document),
    finishSlow: () => deferred.splice(0).forEach(finish => finish()),
    revoke() { active = false; abort.abort(); cleanup.forEach(fn => fn()); },
  };
}
