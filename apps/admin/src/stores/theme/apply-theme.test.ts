import { afterEach, describe, expect, it } from 'vitest';

import { makeStore } from '@/stores/store';

import { applyTheme, syncThemeToDocument } from './apply-theme';
import { setTheme } from './theme-slice';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('applyTheme', () => {
  it('sets data-theme="dark" for the dark theme', () => {
    const root = document.createElement('html');

    applyTheme('dark', root);

    expect(root.dataset['theme']).toBe('dark');
  });

  it('sets data-theme="light" for the light theme', () => {
    const root = document.createElement('html');

    applyTheme('light', root);

    expect(root.dataset['theme']).toBe('light');
  });

  it('removes data-theme for the system theme, so the CSS follows prefers-color-scheme', () => {
    const root = document.createElement('html');
    root.dataset['theme'] = 'dark';

    applyTheme('system', root);

    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});

describe('syncThemeToDocument', () => {
  it('applies the current theme of the store at once', () => {
    const store = makeStore({ theme: { theme: 'dark' } });

    syncThemeToDocument(store);

    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('follows every later change of the theme', () => {
    const store = makeStore({ theme: { theme: 'system' } });
    syncThemeToDocument(store);

    store.dispatch(setTheme('light'));

    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('stops following changes once unsubscribed', () => {
    const store = makeStore({ theme: { theme: 'system' } });
    const unsubscribe = syncThemeToDocument(store);

    unsubscribe();
    store.dispatch(setTheme('dark'));

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
