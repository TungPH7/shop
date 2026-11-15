import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveTheme } from '@/stores/persistence';

// public/theme-init.js is a classic script that index.html runs in <head>, before the
// first paint. Importing it runs it once; resetModules lets each test run it again.
const themeInitPath = '../public/theme-init.js';

async function runThemeInit(): Promise<void> {
  await import(/* @vite-ignore */ themeInitPath);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('theme-init.js', () => {
  it('puts a stored dark theme on <html> as data-theme', async () => {
    saveTheme('dark');

    await runThemeInit();

    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('puts a stored light theme on <html> as data-theme', async () => {
    saveTheme('light');

    await runThemeInit();

    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('leaves data-theme off for the stored system theme', async () => {
    saveTheme('system');

    await runThemeInit();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('leaves data-theme off when no theme is stored', async () => {
    await runThemeInit();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('ignores a stored theme of another schema version', async () => {
    localStorage.setItem('tungph7.theme', JSON.stringify({ v: 2, theme: 'dark' }));

    await runThemeInit();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('ignores a stored value that is not a theme', async () => {
    localStorage.setItem('tungph7.theme', JSON.stringify({ v: 1, theme: 'sepia' }));

    await runThemeInit();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('ignores a stored value that is not JSON', async () => {
    localStorage.setItem('tungph7.theme', '{dark');

    await runThemeInit();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
