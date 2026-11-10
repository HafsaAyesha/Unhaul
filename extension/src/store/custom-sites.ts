import { browser } from 'wxt/browser';
import { STORE_HOST_PERMISSIONS } from './stores';

const CHROME_OWNED_HOSTS = new Set([
  'chrome.google.com',
  'chromewebstore.google.com',
  'webstore.google.com',
  'extensions.google.com',
]);

export function canRunOnSite(builtIn: boolean, customEnabled: boolean): boolean {
  return builtIn || customEnabled;
}

export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || CHROME_OWNED_HOSTS.has(host)
      || /^[\d.]+$/.test(host) || host.includes(':')) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

export async function listCustomSites(): Promise<string[]> {
  const builtIn = new Set(STORE_HOST_PERMISSIONS.map(permission => permission.slice(0, -2)));
  const permissions = await browser.permissions.getAll();
  return (permissions.origins ?? [])
    .map(origin => origin.endsWith('/*') ? origin.slice(0, -2) : origin)
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin !== null && !builtIn.has(origin))
    .sort();
}

export async function syncCustomContentScripts(): Promise<void> {
  if (!browser.scripting || !browser.permissions) return;
  const registered = await browser.scripting.getRegisteredContentScripts();
  const ids = registered.map(script => script.id).filter(id => id.startsWith('unhaul-custom-'));
  if (ids.length) await browser.scripting.unregisterContentScripts({ ids });
  const origins = await listCustomSites();
  if (!origins.length) return;
  const js = browser.runtime.getManifest().content_scripts?.[0]?.js;
  if (!js?.length) throw new Error('The built content script is not available.');
  await browser.scripting.registerContentScripts([{
    id: 'unhaul-custom-sites',
    matches: origins.map(origin => `${origin}/*`),
    js,
    runAt: 'document_idle',
    persistAcrossSessions: true,
  }]);
}
