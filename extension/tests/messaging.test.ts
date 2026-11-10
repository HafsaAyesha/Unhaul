import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  changed: vi.fn(),
  removeChanged: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({ schemaVersion: 1, consentGiven: true }),
  addListener: vi.fn(),
  installed: vi.fn(),
  startup: vi.fn(),
  openOptionsPage: vi.fn().mockResolvedValue(undefined),
  initializeStorage: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn(),
}));
<<<<<<< HEAD
vi.mock('../src/storage/repo', () => ({ initializeStorage: mocks.initializeStorage, getSettings: mocks.getSettings }));
=======
vi.mock('../src/storage/repo', () => ({
  initializeStorage: mocks.initializeStorage,
  rescheduleReminders: vi.fn(async () => {}),
  handleSavedAlarm: vi.fn(),
  recordVisit: vi.fn(),
  upsertSaved: vi.fn(),
  waitDeadline: vi.fn(),
  getSettings: vi.fn(),
}));
>>>>>>> 38a0ce5 (cleaning)
vi.mock('wxt/browser', () => ({ browser: {
  storage: { onChanged: { addListener: mocks.changed, removeListener: mocks.removeChanged } },
  runtime: { openOptionsPage: mocks.openOptionsPage, onInstalled: { addListener: mocks.installed }, onStartup: { addListener: mocks.startup }, id: 'unhaul-test', onMessage: { addListener: mocks.addListener }, sendMessage: mocks.sendMessage },
} }));
vi.stubGlobal('defineBackground', (main: () => void) => main);
vi.stubGlobal('defineContentScript', (definition: unknown) => definition);

describe('entrypoint connectivity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.sendMessage.mockReset();
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
      const content = (await import('../entrypoints/content')).default as unknown as { main: (ctx: { onInvalidated: ReturnType<typeof vi.fn> }) => Promise<void> };
      await content.main({ onInvalidated: vi.fn() });
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
  it('does nothing beyond consent lookup when consent is denied', async () => {
    mocks.sendMessage.mockResolvedValueOnce({ consentGiven: false });
    const content = (await import('../entrypoints/content')).default as unknown as { main: (ctx: { onInvalidated: ReturnType<typeof vi.fn> }) => Promise<void> };
    const onInvalidated = vi.fn();
    await content.main({ onInvalidated });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).toHaveBeenCalledWith({ type: 'GET_CONSENT' });
    expect(mocks.changed).toHaveBeenCalledTimes(1);
    onInvalidated.mock.calls[0][0]();
    expect(mocks.removeChanged).toHaveBeenCalledWith(mocks.changed.mock.calls[0][0]);
  });
  it('rechecks consent and starts once when an already-open tab receives agreement', async () => {
    mocks.sendMessage.mockResolvedValueOnce({ consentGiven: false })
      .mockResolvedValueOnce({ consentGiven: true }).mockResolvedValueOnce({ type: 'PONG' });
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const onInvalidated = vi.fn();
    try {
      const content = (await import('../entrypoints/content')).default as unknown as { main: (ctx: { onInvalidated: ReturnType<typeof vi.fn> }) => Promise<void> };
      await content.main({ onInvalidated });
      const changed = mocks.changed.mock.calls[0][0];
      changed({ 'unhaul:settings': { newValue: { schemaVersion: 1, consentGiven: true } } }, 'local');
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith('[Unhaul] PONG'));
      expect(mocks.sendMessage.mock.calls.filter(([message]) => message.type === 'PING')).toHaveLength(1);
      changed({ 'unhaul:settings': { oldValue: { schemaVersion: 1, consentGiven: true } } }, 'local');
      expect(mocks.sendMessage).toHaveBeenCalledTimes(3);
      onInvalidated.mock.calls[0][0]();
      changed({ 'unhaul:settings': { newValue: { schemaVersion: 1, consentGiven: true } } }, 'local');
      expect(mocks.sendMessage).toHaveBeenCalledTimes(3);
    } finally { log.mockRestore(); }
  });
  it('reports messaging failure without logging success', async () => {
    mocks.sendMessage.mockResolvedValueOnce({ consentGiven: true }).mockRejectedValueOnce(new Error('Disconnected'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const content = (await import('../entrypoints/content')).default as unknown as { main: (ctx: { onInvalidated: ReturnType<typeof vi.fn> }) => Promise<void> };
      await content.main({ onInvalidated: vi.fn() });
      expect(error).toHaveBeenCalledWith('[Unhaul] Background connection failed', expect.any(Error));
      expect(log).not.toHaveBeenCalled();
    } finally { error.mockRestore(); log.mockRestore(); }
  });
});
