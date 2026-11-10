// The single list of stores Unhaul runs on. wxt.config.ts (host_permissions),
// entrypoints/content.ts (matches) and src/store/extract.ts all read it, so adding a
// store here is the only code change. Add a fixture and check it with `npm run fixtures:check`.
// Each domain covers the bare host and its www. host, and nothing else. Never <all_urls>.
export const STORE_DOMAINS = [
  'daraz.pk',
  'bonanzasatrangi.com',
  'crossstitch.pk',
  'junaidjamshed.com',
  'outfitters.com.pk',
  'zellbury.com',
  // Passed `npm run stores:check` on 2026-11-10 (stationery, toys, gifts, decor).
  'stationers.pk',
  'thestationerycompany.pk',
  'zubaidas.com',
  'rung.com.pk',
  'theschoolstore.pk',
  'saleemibookdepot.com',
  'toycompany.pk',
  'toynix.pk',
  'odeez.pk',
  'babybazar.pk',
  'chasevalue.pk',
  'designyourown.pk',
  'blingspot.pk',
  'soz.com.pk',
  'nishatlinen.com',
] as const;

const hosts = STORE_DOMAINS.flatMap(domain => [domain, `www.${domain}`]);

export const STORE_HOST_PERMISSIONS = hosts.map(host => `https://${host}/*`);
export const STORE_PRODUCT_MATCHES = hosts.map(host => `https://${host}/products/*`);

export function isSupportedStoreHost(hostname: string): boolean {
  return hosts.includes(hostname.toLowerCase());
}
