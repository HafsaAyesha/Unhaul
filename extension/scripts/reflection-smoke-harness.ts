// Synthetic browser harness only; never an extension entrypoint or production global.
import { mountReflectionExperience } from '../src/ui/experience';
import { classifyKeywords } from '../src/classify/keywords';
import { findMatches } from '../src/match/match';
import { sampleItems } from '../src/storage/sample-items';
import { extractProduct } from '../src/store/extract';
import { choosePrompt } from '../src/match/prompts';
import type { AnalysisResult, Product } from '../src/shared/types';
export function start() {
  let active = true; const abort = new AbortController(); const cleanup: (() => void)[] = [];
  const claimed = new Set<string>();
  const deferred: (() => void)[] = [];
  let analyses = 0; let claims = 0;
  const scope = { signal: abort.signal, isCurrent: () => active, onCleanup: (fn: () => void) => { cleanup.push(fn); } };
  const experience = mountReflectionExperience({ scope, cancelAnalysis() {},
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
    read: () => extractProduct(document),
    finishSlow: () => deferred.splice(0).forEach(finish => finish()),
    revoke() { active = false; abort.abort(); cleanup.forEach(fn => fn()); },
  };
}
