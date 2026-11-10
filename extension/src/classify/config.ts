/** Public build settings only. A token shipped in an extension is not a durable secret. */
declare const __UNHAUL_PROXY_URL__: string;
declare const __UNHAUL_EXTENSION_TOKEN__: string;
export function proxyConfig(): { url: string; token: string } {
  return {
    url: typeof __UNHAUL_PROXY_URL__ === 'string' ? __UNHAUL_PROXY_URL__ : '',
    token: typeof __UNHAUL_EXTENSION_TOKEN__ === 'string' ? __UNHAUL_EXTENSION_TOKEN__ : '',
  };
}
export const CLASSIFIER_VERSION = 'general-v1-gpt4o-mini';
