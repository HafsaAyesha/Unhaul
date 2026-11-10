import { expect, it } from 'vitest';
import { isSettings } from '../src/shared/storage-validation';
import { isStorageRequest } from '../src/shared/storage-messages';

it('accepts an optional boolean cooldownLock and rejects other values', () => {
  expect(isSettings({ schemaVersion: 1, consentGiven: true })).toBe(true);
  expect(isSettings({ schemaVersion: 1, consentGiven: true, cooldownLock: true })).toBe(true);
  expect(isSettings({ schemaVersion: 1, consentGiven: true, cooldownLock: 'yes' })).toBe(false);
});

it('validates the settings mutation request shape', () => {
  expect(isStorageRequest({ type: 'STORAGE', operation: 'setCooldownLock', args: [true] })).toBe(true);
  expect(isStorageRequest({ type: 'STORAGE', operation: 'setCooldownLock', args: ['true'] })).toBe(false);
});
