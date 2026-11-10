import { defineConfig } from 'wxt';
export default defineConfig({
  // Load the generated build in the dedicated Unhaul test profile manually.
  webExt: { disabled: true },
  manifest: {
    name: 'Unhaul',
    description: 'Pause before impulse purchases across product categories.',
    permissions: ['storage', 'alarms', 'notifications'],
    action: { default_icon: { 128: 'icon/128.png' } },
    icons: { 128: 'icon/128.png' },
    host_permissions: ['https://www.daraz.pk/*'],
  },
});
