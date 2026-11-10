import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getRegisteredContentScripts: vi.fn(),
  unregisterContentScripts: vi.fn(),
  registerContentScripts: vi.fn(),
}));
vi.mock('wxt/browser', () => ({
  browser: {
    permissions: { getAll: mocks.getAll },
    scripting: {
      getRegisteredContentScripts: mocks.getRegisteredContentScripts,
      unregisterContentScripts: mocks.unregisterContentScripts,
      registerContentScripts: mocks.registerContentScripts,
    },
    runtime: { getManifest: () => ({ content_scripts: [{ js: ['content-scripts/content.js'] }] }) },
  },
}));

describe('custom sites', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAll.mockResolvedValue({ origins: [] });
    mocks.getRegisteredContentScripts.mockResolvedValue([]);
  });

  it.each([
    ['http://example.com', null],
    ['https://example.com:8443', null],
    ['https://user:pass@example.com', null],
    ['https://127.0.0.1', null],
    ['https://localhost', null],
    ['https://example.com/shop', 'https://example.com'],
    ['https://www.example.com', 'https://www.example.com'],
  ])('normalizes %s', async (value, expected) => {
    const { normalizeOrigin } = await import('../src/store/custom-sites');
    expect(normalizeOrigin(value)).toBe(expected);
  });

  it('gates content to built-in or granted custom sites', async () => {
    const { canRunOnSite } = await import('../src/store/custom-sites');
    expect(canRunOnSite(true, false)).toBe(true);
    expect(canRunOnSite(false, true)).toBe(true);
    expect(canRunOnSite(false, false)).toBe(false);
  });

  it('lists granted origins without built-in stores', async () => {
    mocks.getAll.mockResolvedValue({ origins: ['https://daraz.pk/*', 'https://example.com/*'] });
    const { listCustomSites } = await import('../src/store/custom-sites');
    expect(await listCustomSites()).toEqual(['https://example.com']);
  });

  it('replaces the dynamic registration and unregisters when empty', async () => {
    mocks.getAll.mockResolvedValue({ origins: ['https://example.com/*', 'https://www.example.com/*'] });
    mocks.getRegisteredContentScripts.mockResolvedValue([{ id: 'unhaul-custom-old' }, { id: 'other' }]);
    const { syncCustomContentScripts } = await import('../src/store/custom-sites');
    await syncCustomContentScripts();
    expect(mocks.unregisterContentScripts).toHaveBeenCalledWith({ ids: ['unhaul-custom-old'] });
    expect(mocks.registerContentScripts).toHaveBeenCalledWith([expect.objectContaining({
      id: 'unhaul-custom-sites',
      matches: ['https://example.com/*', 'https://www.example.com/*'],
      js: ['content-scripts/content.js'],
      runAt: 'document_idle',
      persistAcrossSessions: true,
    })]);
    mocks.getAll.mockResolvedValue({ origins: [] });
    await syncCustomContentScripts();
    expect(mocks.unregisterContentScripts).toHaveBeenCalledTimes(2);
  });
});
