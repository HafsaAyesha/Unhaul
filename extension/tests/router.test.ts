import { describe, expect, it } from 'vitest';
import { createRouter, viewFromHash } from '../entrypoints/options/router';

class FakeElement {
  hidden = false;
  attributes = new Map<string, string>();
  handler?: () => void;
  querySelector<T>(): T | null { return this as unknown as T; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  addEventListener(_type: string, handler: () => void): void { this.handler = handler; }
  focus(): void {}
}

it('maps unknown hashes to home', () => {
  expect(viewFromHash('#unknown')).toBe('home');
  expect(viewFromHash('#dashboard')).toBe('dashboard');
});

describe('createRouter', () => {
  it('shows the hash view and marks its navigation button current', () => {
    const names = ['home', 'items', 'saved', 'dashboard', 'settings'];
    const sections = new Map(names.map(name => [name, new FakeElement()]));
    const buttons = new Map(names.map(name => [name, new FakeElement()]));
    const listeners = new Map<string, () => void>();
    const win = {
      location: { hash: '#items' },
      addEventListener: (_type: string, handler: () => void) => listeners.set('hashchange', handler),
      removeEventListener: () => {},
    };
    const root = {
      defaultView: win,
      querySelector: (selector: string) => {
        const name = selector.match(/"(.*?)"/)?.[1] ?? '';
        return selector.startsWith('[data-view') ? sections.get(name) : buttons.get(name);
      },
    } as unknown as ParentNode;
    const router = createRouter(root);
    expect(router.current).toBe('items');
    expect(sections.get('items')?.hidden).toBe(false);
    expect(buttons.get('items')?.attributes.get('aria-current')).toBe('page');
    router.navigate('saved');
    expect(router.current).toBe('saved');
    expect(sections.get('items')?.hidden).toBe(true);
    expect(buttons.get('items')?.attributes.has('aria-current')).toBe(false);
    expect(buttons.get('saved')?.attributes.get('aria-current')).toBe('page');
    router.dispose();
    expect(listeners.has('hashchange')).toBe(true);
  });
});
