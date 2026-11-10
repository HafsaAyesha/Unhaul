import { defineConfig } from 'wxt';
import { STORE_HOST_PERMISSIONS } from './src/store/stores';
// Public build configuration. Supply these variables to the build process.
const proxy = process.env.PROXY_URL ?? '';
let proxyHost: string[] = [];
if (proxy) {
  const url = new URL(proxy);
  if (url.protocol !== 'https:' || url.port || url.hostname.includes('*') || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('PROXY_URL must be an HTTPS origin without credentials, path or query.');
  }
  proxyHost = [`${url.origin}/*`];
}
export default defineConfig({
  vite: () => ({ define: { __UNHAUL_PROXY_URL__: JSON.stringify(proxy), __UNHAUL_EXTENSION_TOKEN__: JSON.stringify(process.env.EXTENSION_TOKEN ?? '') } }),
  // Load the generated build in the dedicated Unhaul test profile manually.
  webExt: { disabled: true },
  manifest: {
    name: 'Unhaul',
    description: 'Pause before impulse purchases across product categories.',
    icons: { 128: 'icon/128.png' },
    action: { default_title: 'Open Unhaul', default_icon: { 128: 'icon/128.png' } },
    // Public key only (not a secret): fixes the extension ID to poclfboelhiknbalppadihkdciclhlha for every
    // unpacked install, so the proxy's ALLOWED_ORIGINS can name it. No private key is kept or needed.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0NZ1Yi1+xZib2JzzoBreJ8nZHBXFMtmKVOKZq/jVU+7LJXELlcXMpCmQ3lRjoka+CPK2kHWEwk6WYCgUNKEsLCIpcuOO2Mi3aUJma4Us3A/invVM6pmtQwHhSfXctj/K8fFpU4ZUDyKdJZY/LAK3HbzccGWFb8EvU5MEWZi6aAjaeDcvl1qgpZ4PoTQUcBtWiKSt9ae/lxONrRKmln8IWYpmUoiFfmPFGBD1rwqTnsW6Nt0/kKPgfFYcNM/a7b9kihWQyYX+vStCsXCmnwPpTbvHkEyZXHKvhqr1+QkEuFjxmRMzyHQiZ5JR0wosY08Dlydu7PNSyDQ21iMmzS05YwIDAQAB',
    action: { default_title: 'Open Unhaul' },
    permissions: ['storage'],
    host_permissions: [...STORE_HOST_PERMISSIONS, ...proxyHost],
  },
});
