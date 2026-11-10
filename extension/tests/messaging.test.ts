import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('wxt/browser', () => ({ browser: {
  runtime: { id: 'unhaul-test', onMessage: { addListener: mocks.addListener }, sendMessage: mocks.sendMessage },
} }));
vi.stubGlobal('defineBackground', (main: () => void) => main);
vi.stubGlobal('defineContentScript', (definition: unknown) => definition);

describe('entrypoint connectivity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
