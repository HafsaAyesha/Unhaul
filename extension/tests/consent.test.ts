import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOptionsController, type OptionsState } from '../entrypoints/options/controller';
import { DEFAULT_SETTINGS } from '../src/shared/types';
import { sampleItems } from '../src/storage/sample-items';
const client = { getSettings: vi.fn(), setConsent: vi.fn(), getItems: vi.fn(), loadSampleItems: vi.fn(), deleteAllUnhaulData: vi.fn() };
let state: OptionsState;
let controller: ReturnType<typeof createOptionsController>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  client.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS });
  client.getItems.mockResolvedValue(sampleItems);
  client.setConsent.mockResolvedValue(undefined);
  client.deleteAllUnhaulData.mockResolvedValue(undefined);
  client.loadSampleItems.mockResolvedValue(sampleItems.length);
  controller = createOptionsController(client, next => { state = next; });
});
describe('options consent', () => {
  it('shows loading without private items while settings are pending', async () => {
    const pending = deferred<typeof DEFAULT_SETTINGS>();
    client.getSettings.mockReturnValueOnce(pending.promise);
    const refresh = controller.refresh();
    expect(state.screen).toBe('loading'); expect(state.items).toEqual([]);
    expect(client.getItems).not.toHaveBeenCalled();
    pending.resolve({ ...DEFAULT_SETTINGS }); await refresh;
    expect(state.screen).toBe('consent'); expect(state.busy).toBe(false);
  });
  it('does not grant false or missing-default consent or read owned items', async () => {
    await controller.refresh();
    expect(state.screen).toBe('consent'); expect(client.getItems).not.toHaveBeenCalled();
    expect(client.setConsent).not.toHaveBeenCalled();
  });
  it('rejects malformed settings without displaying My Items', async () => {
    client.getSettings.mockResolvedValueOnce({ schemaVersion: 1 });
    await controller.refresh(); expect(state.screen).toBe('error');
    expect(client.getItems).not.toHaveBeenCalled();
  });
  it('shows an error on failed settings read and permits retry', async () => {
    client.getSettings.mockRejectedValueOnce(new Error('Storage unavailable'));
    await controller.refresh(); expect(state.screen).toBe('error'); expect(state.error).toBe('Storage unavailable');
    expect(client.getItems).not.toHaveBeenCalled();
    await controller.refresh(); expect(state.screen).toBe('consent');
  });
  it('loads existing My Items only after consent is read', async () => {
    client.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, consentGiven: true });
    await controller.refresh(); expect(state.screen).toBe('items'); expect(state.items).toEqual(sampleItems);
    expect(client.setConsent).not.toHaveBeenCalled();
  });
  it('waits for persistence and ignores repeated agreement clicks', async () => {
    await controller.refresh();
    const save = deferred<void>(); client.setConsent.mockReturnValueOnce(save.promise);
    const agree = controller.agree(); await controller.agree();
    expect(state.screen).toBe('consent'); expect(state.busy).toBe(true);
    expect(client.setConsent).toHaveBeenCalledTimes(1); expect(client.getItems).not.toHaveBeenCalled();
    controller.settingsChanged({ ...DEFAULT_SETTINGS, consentGiven: true });
    expect(state.screen).toBe('consent');
    client.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, consentGiven: true });
    save.resolve(); await agree;
    expect(state.screen).toBe('items'); expect(state.items).toEqual(sampleItems);
  });
  it('keeps consent visible and reports a failed agreement save', async () => {
    await controller.refresh(); client.setConsent.mockRejectedValueOnce(new Error('Quota exceeded'));
    await controller.agree(); expect(state.screen).toBe('consent'); expect(state.busy).toBe(false);
    expect(state.error).toBe('Quota exceeded'); expect(client.getItems).not.toHaveBeenCalled();
  });
  it('Not now leaves records untouched and My Items hidden', async () => {
    await controller.refresh(); controller.notNow();
    expect(state.screen).toBe('consent'); expect(state.status).toContain('remains disabled');
    expect(client.setConsent).not.toHaveBeenCalled(); expect(client.deleteAllUnhaulData).not.toHaveBeenCalled();
    expect(client.getItems).not.toHaveBeenCalled();
  });
  it.each([undefined, { ...DEFAULT_SETTINGS }])('hides owned items immediately on consent removal: %j', async value => {
    client.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, consentGiven: true });
    await controller.refresh(); controller.settingsChanged(value);
    expect(state.screen).toBe('consent'); expect(state.items).toEqual([]);
  });
  it('does not reveal stale items when consent is removed during a pending read', async () => {
    client.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, consentGiven: true });
    const pending = deferred<typeof sampleItems>(); client.getItems.mockReturnValueOnce(pending.promise);
    const refresh = controller.refresh(); await Promise.resolve();
    controller.settingsChanged(undefined); pending.resolve(sampleItems); await refresh;
    expect(state.screen).toBe('consent'); expect(state.items).toEqual([]);
  });
  it('does not reveal items when consent is revoked during pending agreement', async () => {
    await controller.refresh(); const pending = deferred<void>(); client.setConsent.mockReturnValueOnce(pending.promise);
    const agree = controller.agree(); controller.settingsChanged(undefined); pending.resolve(); await agree;
    expect(state.screen).toBe('consent'); expect(client.getItems).not.toHaveBeenCalled();
  });
  it('loads samples after agreement and returns to consent after deletion without initialization', async () => {
    client.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, consentGiven: true });
    await controller.refresh(); await controller.loadSamples();
    expect(client.loadSampleItems).toHaveBeenCalledTimes(1); expect(state.screen).toBe('items');
    await controller.deleteData(); expect(client.deleteAllUnhaulData).toHaveBeenCalledTimes(1);
    expect(state.screen).toBe('consent'); expect(state.items).toEqual([]);
    expect(client.setConsent).not.toHaveBeenCalled();
  });
});
