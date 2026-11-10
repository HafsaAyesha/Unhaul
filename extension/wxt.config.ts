import { defineConfig } from 'wxt';
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
<<<<<<< HEAD
    permissions: ['storage', 'alarms', 'notifications'],
    action: { default_icon: { 128: 'icon/128.png' } },
    icons: { 128: 'icon/128.png' },
    host_permissions: ['https://www.daraz.pk/*'],
=======
    permissions: ['storage'],
    host_permissions: ['https://www.daraz.pk/*', ...proxyHost],
>>>>>>> 2af525da18ce24d9afafd49b6aba7ae3e6b8fb65
  },
});
