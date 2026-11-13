import { describe, expect, it } from 'vitest';

import { setTheme, themeReducer, toggleTheme } from './theme-slice';

describe('theme slice', () => {
  it('setTheme replaces the theme', () => {
    expect(themeReducer({ theme: 'system' }, setTheme('dark'))).toEqual({ theme: 'dark' });
  });

  it('toggleTheme flips dark<->light (system resolves to dark)', () => {
    expect(themeReducer({ theme: 'dark' }, toggleTheme())).toEqual({ theme: 'light' });
    expect(themeReducer({ theme: 'light' }, toggleTheme())).toEqual({ theme: 'dark' });
    expect(themeReducer({ theme: 'system' }, toggleTheme())).toEqual({ theme: 'dark' });
  });

  it('returns the initial state by default', () => {
    expect(themeReducer(undefined, { type: '@@INIT' })).toEqual({ theme: 'system' });
  });
});
