/** Background-only lifecycle state. Never persist or accept these tokens from messages. */
export interface ConsentWork {
  readonly generation: number;
  readonly signal: AbortSignal;
  release(): void;
}
let generation = 0;
const controllers = new Set<AbortController>();
const issued = new WeakSet<ConsentWork>();
export function invalidateConsentWork(): void {
  generation++;
  for (const controller of controllers) controller.abort();
  controllers.clear();
}
export function currentConsentGeneration(): number { return generation; }
export function createConsentWork(): ConsentWork {
  const controller = new AbortController();
  controllers.add(controller);
  const work: ConsentWork = {
    generation, signal: controller.signal,
    release: () => { controllers.delete(controller); controller.abort(); },
  };
  issued.add(work);
  return work;
}
export function isCurrentConsentWork(work: ConsentWork): boolean {
  return issued.has(work) && !work.signal.aborted && work.generation === generation;
}
