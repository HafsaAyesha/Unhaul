import type { Product } from '../shared/types';
import { record } from '../shared/storage-validation';
import { isSupportedStoreHost } from './stores';
function urlValue(value: unknown, base: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function price(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
}
function flatten(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!record(value)) return [];
  return [value, ...flatten(value['@graph'])];
}
/** Structured Product data first, product Open Graph second. No guessed DOM selectors/prices. */
export function extractProduct(doc: Document, href = doc.location.href): Product | null {
  return isSupportedStoreHost(new URL(href).hostname) ? readProductPage(doc, href) : null;
}
/** The same reader without the store allowlist. scripts/check-stores.mjs uses it to vet candidate stores. */
export function readProductPage(doc: Document, href = doc.location.href): Product | null {
  const current = new URL(href);
  if (!current.pathname.startsWith('/products/')) return null;
  const meta = (name: string) => doc.querySelector<HTMLMetaElement>(`meta[property="${name}"]`)?.content?.trim() || null;
  const canonical = meta('og:url');
  if (canonical) {
    const candidate = urlValue(canonical, href);
    if (!candidate || new URL(candidate).pathname !== current.pathname) return null;
  }
  const variantId = current.searchParams.get('sku_id') || current.searchParams.get('variant') || undefined;
  const nodes = [...doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')].flatMap(script => {
    try { return flatten(JSON.parse(script.textContent ?? '')); } catch { return []; }
  });
  // Shopify themes publish either Product or ProductGroup (variants under hasVariant).
  const isProduct = (node: Record<string, unknown>) => [node['@type']].flat().some(type => type === 'Product' || type === 'ProductGroup');
  const product = nodes.find(isProduct);
  if (product?.url) {
    const candidate = urlValue(product.url, href);
    if (!candidate || new URL(candidate).pathname !== current.pathname) return null;
  }
  const offers = product ? [...flatten(product.offers), ...flatten(product.hasVariant).flatMap(variant => flatten(variant.offers))] : [];
  // No variant chosen: use the offer only when every offer has the same price and currency.
  const samePrice = offers.length > 0 && offers.every(entry => String(entry.price) === String(offers[0].price)
    && entry.priceCurrency === offers[0].priceCurrency);
  const offer = variantId ? offers.find(entry => String(entry.sku ?? '') === variantId)
    : samePrice ? offers[0] : undefined;
  const title = typeof product?.name === 'string' ? product.name.trim() : meta('og:title');
  const productEvidence = Boolean(product) || meta('og:type') === 'product' || meta('product:price:amount') !== null;
  if (!productEvidence || !title) return null;
  const canonicalURL = new URL(current.href); canonicalURL.search = ''; canonicalURL.hash = '';
  const productId = typeof product?.productID === 'string' ? product.productID : canonicalURL.href;
  // Without variant-specific offer evidence, do not pretend the generic price is current.
  const currentPrice = price(offer?.price ?? (!variantId ? meta('product:price:amount') : undefined));
  const currencyValue = offer?.priceCurrency ?? (!variantId ? meta('product:price:currency') : null);
  const currency = typeof currencyValue === 'string' && /^[A-Z]{3}$/.test(currencyValue) ? currencyValue : null;
  const previous = !variantId ? price(meta('product:original_price:amount')) : null;
  const previousCurrency = meta('product:original_price:currency');
  const wasPrice = previous !== null && currentPrice !== null && previous > currentPrice
    && currency !== null && previousCurrency === currency ? previous : null;
  const image = Array.isArray(product?.image) ? product.image[0] : product?.image;
  const imageURL = record(image) ? image.url : image;
  return {
    store: current.hostname, productId, variantId, url: current.href, title,
    price: currentPrice, wasPrice, currency, imageUrl: urlValue(imageURL, href) ?? urlValue(meta('og:image'), href),
    categoryText: typeof product?.category === 'string' ? product.category : undefined,
  };
}
