/** For the badge/panel: publish basic results first and ignore superseded replies. */
import { send } from '../shared/messages';
import { isAnalysisResult } from '../shared/analysis-validation';
import type { AnalysisResult, Product } from '../shared/types';
export function createAnalysisClient() {
  let revision = 0;
  return {
    cancel() { revision++; },
    async analyze(product: Product, publish: (result: AnalysisResult) => void, signal: AbortSignal): Promise<void> {
      const current = ++revision;
      const valid = () => current === revision && !signal.aborted;
      if (!valid()) return;
      const basic = await send({ type: 'PRODUCT_SEEN', product });
      if (!valid() || !isAnalysisResult(basic) || basic.productId !== product.productId) return;
      publish(basic);
      if (!basic.refinementAvailable || !valid()) return;
      try {
        const refined = await send({ type: 'REFINE_PRODUCT', analysisId: basic.analysisId });
        if (valid() && isAnalysisResult(refined) && refined.analysisId === basic.analysisId && refined.productId === product.productId) publish(refined);
      } catch { /* Keep the already-published basic result when refinement fails. */ }
    },
  };
}
