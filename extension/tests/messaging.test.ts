import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  installed: vi.fn(),
  startup: vi.fn(),
  openOptionsPage: vi.fn().mockResolvedValue(undefined),
  initializeStorage: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn(),
}));
vi.mock('../src/storage/repo', () => ({ initializeStorage: mocks.initializeStorage }));
vi.mock('wxt/browser', () => ({ browser: {
  runtime: { openOptionsPage: mocks.openOptionsPage, onInstalled: { addListener: mocks.installed }, onStartup: { addListener: mocks.startup }, id: 'unhaul-test', onMessage: { addListener: mocks.addListener }, sendMessage: mocks.sendMessage },
} }));
vi.stubGlobal('defineBackground', (main: () => void) => main);
vi.stubGlobal('defineContentScript', (definition: unknown) => definition);

describe('entrypoint connectivity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  it('initializes storage on installation and browser startup', async () => {
    const background = (await import('../entrypoints/background')).default as unknown as () => void;
    background();
    await mocks.installed.mock.calls[0][0]({ reason: 'install' });
    await mocks.startup.mock.calls[0][0]();
    expect(mocks.initializeStorage).toHaveBeenCalledTimes(2);
  });
  it('reports lifecycle initialization failures explicitly', async () => {
    const failure = new Error('Storage unavailable');
    mocks.initializeStorage.mockRejectedValueOnce(failure);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const background = (await import('../entrypoints/background')).default as unknown as () => void;
      background();
      await mocks.installed.mock.calls[0][0]({ reason: 'install' });
      expect(error).toHaveBeenCalledWith('[Unhaul] Storage initialization failed; existing data retained', failure);
    } finally { error.mockRestore(); }
  });
  it('opens onboarding only for first installation after initialization', async () => {
    const background = (await import('../entrypoints/background')).default as unknown as () => void;
    background();
    await mocks.installed.mock.calls[0][0]({ reason: 'update' });
    await mocks.startup.mock.calls[0][0]();
    expect(mocks.openOptionsPage).not.toHaveBeenCalled();
    await mocks.installed.mock.calls[0][0]({ reason: 'install' });
    expect(mocks.openOptionsPage).toHaveBeenCalledTimes(1);
    expect(mocks.initializeStorage.mock.invocationCallOrder[2]).toBeLessThan(mocks.openOptionsPage.mock.invocationCallOrder[0]);
  });
  it('does not open onboarding if initialization fails', async () => {
    mocks.initializeStorage.mockRejectedValueOnce(new Error('Read failed'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const background = (await import('../entrypoints/background')).default as unknown as () => void;
      background();
      await mocks.installed.mock.calls[0][0]({ reason: 'install' });
      expect(mocks.openOptionsPage).not.toHaveBeenCalled();
    } finally { error.mockRestore(); }
  });
  it('reports an explicit options-opening failure', async () => {
    const failure = new Error('Options unavailable');
    mocks.openOptionsPage.mockRejectedValueOnce(failure);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const background = (await import('../entrypoints/background')).default as unknown as () => void;
      background();
      await mocks.installed.mock.calls[0][0]({ reason: 'install' });
      expect(error).toHaveBeenCalledWith('[Unhaul] Could not open the consent page', failure);
    } finally { error.mockRestore(); }
  });
  it('routes a content PING through the background and logs PONG', async () => {
    const background = (await import('../entrypoints/background')).default as unknown as () => void;
    background();
    const handler = mocks.addListener.mock.calls[0][0];
    mocks.sendMessage.mockImplementation((message: unknown) => new Promise(resolve => {
      handler(message, { id: 'unhaul-test' }, resolve);
    }));
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const content = (await import('../entrypoints/content')).default as unknown as { main: () => Promise<void> };
      await content.main();
      expect(mocks.sendMessage).toHaveBeenCalledWith({ type: 'PING' });
      expect(log).toHaveBeenCalledWith('[Unhaul] PONG');
    } finally { log.mockRestore(); }
  });
  it('ignores malformed messages and other extension senders', async () => {
    const background = (await import('../entrypoints/background')).default as unknown as () => void;
    background();
    const handler = mocks.addListener.mock.calls[0][0];
    const respond = vi.fn();
    for (const message of [null, 'PING', {}, { type: 'OTHER' }]) handler(message, { id: 'unhaul-test' }, respond);
    handler({ type: 'PING' }, { id: 'different-extension' }, respond);
    expect(respond).not.toHaveBeenCalled();
  });
  it('reports messaging failure without logging success', async () => {
    mocks.sendMessage.mockRejectedValue(new Error('Disconnected'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const content = (await import('../entrypoints/content')).default as unknown as { main: () => Promise<void> };
      await content.main();
      expect(error).toHaveBeenCalledWith('[Unhaul] Background connection failed', expect.any(Error));
      expect(log).not.toHaveBeenCalled();
    } finally { error.mockRestore(); log.mockRestore(); }
  });
});
