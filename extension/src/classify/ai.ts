import type { Classification, Product } from '../shared/types';
import { browser } from 'wxt/browser';
import { parseAIClassification } from './validate';
import { proxyConfig } from './config';
export interface AIOptions { signal?: AbortSignal; timeoutMs?: number; fetcher?: typeof fetch; config?: { url: string; token: string }; }
/** Background-only caller: consent is checked by analysis.ts before invoking this function. */
export async function classifyAI(product: Product, options: AIOptions = {}): Promise<Classification | null> {
  const config = options.config ?? proxyConfig();
  if (!config.url || options.signal?.aborted) return null;
  let endpoint: URL;
  try {
    endpoint = new URL(config.url);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
    endpoint.pathname = '/classify';
  } catch { return null; }
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? 3000);
  // Race even a broken client/mock that ignores AbortSignal; late results never escape.
  const cancelled = new Promise<null>(resolve => controller.signal.addEventListener('abort', () => resolve(null), { once: true }));
  try {
    const payload = JSON.stringify({ title: product.title, categoryText: product.categoryText ?? '', imageUrl: product.imageUrl });
    if (new TextEncoder().encode(payload).length > 2048) return null;
    const request = (async () => {
      const response = await (options.fetcher ?? fetch)(endpoint.href, {
        method: 'POST', redirect: 'error', credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Unhaul-Origin': browser.runtime.getURL('/').replace(/\/$/, ''),
          ...(config.token ? { 'X-Unhaul-Token': config.token } : {}) },
        body: payload,
      });
      if (!response.ok || controller.signal.aborted) return null;
      // Limit response consumption before parsing potentially untrusted proxy data.
      const reader = response.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.length;
        if (size > 8192) { await reader.cancel(); return null; }
        chunks.push(next.value);
      }
      if (controller.signal.aborted) return null;
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return parseAIClassification(JSON.parse(new TextDecoder().decode(bytes)));
    })().catch(() => null);
    return await Promise.race([request, cancelled]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
