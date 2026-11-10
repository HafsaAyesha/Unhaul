/** Background-only orchestration. No product observers or UI are installed here. */
import { beginConsentWork, verifyConsentWork, getItems, getVisits, getClassificationCache, cacheClassification } from '../storage/repo';
import type { ConsentWork } from '../consent/work';
import { isCurrentConsentWork } from '../consent/work';
import type { AnalysisResult, Classification, Product } from '../shared/types';
import { classifyKeywords } from './keywords';
import { classifyAI } from './ai';
import { CLASSIFIER_VERSION, proxyConfig } from './config';
import { findMatches } from '../match/match';
import { choosePrompt } from '../match/prompts';
export function classificationKey(product: Product): string {
  return JSON.stringify([CLASSIFIER_VERSION, new URL(product.url).origin, product.store, product.productId, product.variantId ?? null]);
}
interface Session { id: string; product: Product; work?: ConsentWork; created: number; refining?: Promise<AnalysisResult>; }
export function createAnalysisService() {
  const sessions = new Map<string, Session>();
  const close = (session: Session) => session.work?.release();
  function assertCurrent(owner: string, session: Session): ConsentWork {
    if (sessions.get(owner) !== session || !session.work || !isCurrentConsentWork(session.work)) throw new Error('Analysis was revoked or superseded.');
    return session.work;
  }
  async function result(owner: string, session: Session, classification: Classification, phase: AnalysisResult['phase'], refinementAvailable = false): Promise<AnalysisResult> {
    const work = assertCurrent(owner, session);
    const items = await getItems();
    const visits = await getVisits();
    const now = Date.now();
    // Read existing recorded history only; rerenders never create visits here.
    const repeatVisit = visits.some(visit => visit.productId === session.product.productId
      && visit.times.some(time => now - time >= 30 * 60_000 && now - time <= 30 * 86_400_000));
    await verifyConsentWork(work);
    assertCurrent(owner, session);
    const summary = findMatches(classification, items);
    return { type: 'MATCH_RESULT', productId: session.product.productId, analysisId: session.id,
      classification, ...summary, question: choosePrompt(summary.totalMatches, session.product, repeatVisit), repeatVisit, phase, refinementAvailable };
  }
  return {
    async basic(product: Product, owner: string): Promise<AnalysisResult> {
      for (const [key, session] of sessions) if (Date.now() - session.created > 60_000 || sessions.size >= 64) { close(session); sessions.delete(key); }
      const previous = sessions.get(owner); if (previous) close(previous);
      const session: Session = { id: crypto.randomUUID(), product: structuredClone(product), created: Date.now() };
      sessions.set(owner, session);
      try {
        session.work = await beginConsentWork();
        assertCurrent(owner, session);
        const cache = await getClassificationCache();
        const cached = cache[classificationKey(product)];
        const age = cached ? Date.now() - cached.classifiedAt : Infinity;
        if (cached?.source === 'ai' && age >= 0 && age < 86_400_000) return await result(owner, session, cached, 'cached');
        return await result(owner, session, classifyKeywords(product.title, product.categoryText), 'basic', Boolean(proxyConfig().url));
      } catch (error) { close(session); if (sessions.get(owner) === session) sessions.delete(owner); throw error; }
    },
    async refine(analysisId: string, owner: string): Promise<AnalysisResult> {
      const session = sessions.get(owner);
      if (!session || session.id !== analysisId) throw new Error('Analysis was superseded. Request basic analysis again.');
      const work = assertCurrent(owner, session);
      if (session.refining) return session.refining;
      session.refining = (async () => {
        try {
          await verifyConsentWork(work);
          assertCurrent(owner, session);
          const classification = await classifyAI(session.product, { signal: work.signal });
          await verifyConsentWork(work);
          assertCurrent(owner, session);
          if (classification) {
            await cacheClassification(classificationKey(session.product), classification, work);
            return await result(owner, session, classification, 'ai');
          }
          // Temporary failures are not cached; another basic/refine attempt can retry.
          return await result(owner, session, classifyKeywords(session.product.title, session.product.categoryText), 'fallback');
        } finally { close(session); }
      })();
      return session.refining;
    },
    revoke() { for (const session of sessions.values()) close(session); sessions.clear(); },
  };
}
