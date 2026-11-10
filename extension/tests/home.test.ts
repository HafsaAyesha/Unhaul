import { describe, expect, it } from 'vitest';
import { EXAMPLE_SAVED } from '../src/shared/examples';
import { WAITS } from '../src/shared/lists';
import { homeSummary, journeySteps } from '../entrypoints/options/home';
import type { OwnedItem, Settings } from '../src/shared/types';

const settings = (consentGiven: boolean): Settings => ({ schemaVersion: 1, consentGiven });
const item = (id: string): OwnedItem => ({ id, name: id, category: 'stationery', itemType: 'notebook', source: 'manual', createdAt: 1 });

describe('home journey', () => {
  it('reports empty, partial and complete progress', () => {
    journeySteps(settings(false), [], []).forEach(step => expect(step.done).toBe(false));
    expect(journeySteps(settings(true), [item('one')], [EXAMPLE_SAVED]).map(step => step.done)).toEqual([true, false, true, false]);
    expect(journeySteps(settings(true), [item('one'), item('two'), item('three')], [{ ...EXAMPLE_SAVED, status: 'skipped' }]).map(step => step.done)).toEqual([true, true, true, true]);
  });

  it('counts ready at the deadline and later items as waiting', () => {
    const now = EXAMPLE_SAVED.savedAt + WAITS['3d'];
    const ready = { ...EXAMPLE_SAVED, reconsiderAt: now, deadline: now };
    const waiting = { ...EXAMPLE_SAVED, id: 'later', reconsiderAt: now + 1, deadline: now + 1 };
    expect(homeSummary([ready, waiting], now)).toMatchObject({ ready: 1, waiting: 1 });
  });
});
