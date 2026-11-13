import { afterEach, describe, expect, it } from 'vitest';

import { loadTheme, saveTheme } from './persistence';

const KEY = 'tungph7.theme';

describe('theme persistence', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips a saved theme', () => {
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('returns undefined when nothing is stored', () => {
    expect(loadTheme()).toBeUndefined();
  });

  it('rejects a wrong schema version (graceful fallback)', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 99, theme: 'dark' }));
    expect(loadTheme()).toBeUndefined();
  });

  it('rejects an invalid theme value', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, theme: 'neon' }));
    expect(loadTheme()).toBeUndefined();
  });

  it('rejects malformed JSON', () => {
    localStorage.setItem(KEY, 'not json{');
    expect(loadTheme()).toBeUndefined();
  });
});
