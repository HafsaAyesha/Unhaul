import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_CLASSIFICATION, EXAMPLE_OWNED, EXAMPLE_SAVED } from '../src/shared/examples';
import { DEFAULT_SETTINGS } from '../src/shared/types';
import { KEYS } from '../src/storage/keys';

const local = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { storage: { local } } }));
let data: Record<string, unknown>;
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); data = {};
  local.get.mockImplementation(async (keys: string | string[]) => Object.fromEntries(
    (Array.isArray(keys) ? keys : [keys]).filter(key => Object.hasOwn(data, key))
      .map(key => [key, structuredClone(data[key])])));
  local.set.mockImplementation(async (updates: Record<string, unknown>) => { Object.assign(data, structuredClone(updates)); });
  local.remove.mockImplementation(async (key: string) => { delete data[key]; });
  local.clear.mockImplementation(async () => { data = {}; });
});
const api = () => import('../src/storage/storage');

describe('storage functions used by the options page and background', () => {
  it('returns default settings and saves consent', async () => {
    const s = await api();
    expect(await s.getSettings()).toEqual(DEFAULT_SETTINGS);
    await s.saveSettings({ schemaVersion: 1, consentGiven: true, consentAt: 1 });
    expect(await s.getSettings()).toEqual({ schemaVersion: 1, consentGiven: true, consentAt: 1 });
  });
  it('adds owned items once, under unhaul:owned, and deletes them', async () => {
    const s = await api();
    await s.addOwned(EXAMPLE_OWNED); await s.addOwned(EXAMPLE_OWNED);
    expect(await s.getOwned()).toEqual([EXAMPLE_OWNED]);
    expect(data[KEYS.owned]).toEqual([EXAMPLE_OWNED]);
    await s.deleteOwned(EXAMPLE_OWNED.id);
    expect(await s.getOwned()).toEqual([]);
  });
  it('keeps one saved entry per product', async () => {
    const s = await api();
    await s.upsertSaved(EXAMPLE_SAVED);
    await s.upsertSaved({ ...EXAMPLE_SAVED, status: 'skipped', decidedAt: 5 });
    expect(await s.getSaved()).toEqual([{ ...EXAMPLE_SAVED, status: 'skipped', decidedAt: 5 }]);
  });
  it('records visits and drops ones older than 30 days', async () => {
    const s = await api();
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    data[KEYS.visits] = { p1: { productId: 'p1', times: [old] } };
    const times = await s.recordVisit('p1');
    expect(times).toHaveLength(1);
    expect(times[0]).toBeGreaterThan(old);
  });
  it('caches classifications by product ID', async () => {
    const s = await api();
    expect(await s.getCachedClass('p1')).toBeUndefined();
    await s.setCachedClass('p1', EXAMPLE_CLASSIFICATION);
    expect(await s.getCachedClass('p1')).toEqual(EXAMPLE_CLASSIFICATION);
  });
  it('deletes everything, which resets consent', async () => {
    const s = await api();
    await s.saveSettings({ schemaVersion: 1, consentGiven: true });
    await s.addOwned(EXAMPLE_OWNED); await s.upsertSaved(EXAMPLE_SAVED);
    await s.deleteAll();
    expect(data).toEqual({});
    expect((await s.getSettings()).consentGiven).toBe(false);
  });
});
