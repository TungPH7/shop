import { describe, expect, it } from 'vitest';

import { setTheme, themeReducer } from './theme-slice';

describe('theme slice', () => {
  it('setTheme replaces the theme', () => {
    expect(themeReducer({ theme: 'system' }, setTheme('dark'))).toEqual({ theme: 'dark' });
  });

  it('returns the initial state by default', () => {
    expect(themeReducer(undefined, { type: '@@INIT' })).toEqual({ theme: 'system' });
  });
});
