import { type ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeStore } from '@/stores/store';
import { StoreProvider } from '@/stores/store-provider';

import { isTheme, useTheme } from './use-theme';

function renderUseTheme() {
  const store = makeStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StoreProvider store={store}>{children}</StoreProvider>
  );
  return renderHook(() => useTheme(), { wrapper });
}

describe('useTheme', () => {
  it('lists the themes a switch offers: light, dark and system', () => {
    const { result } = renderUseTheme();

    expect(result.current.themes).toEqual(['light', 'dark', 'system']);
  });
});

describe('isTheme', () => {
  it('accepts each theme', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(true);
  });

  it('rejects any other value', () => {
    expect(isTheme('sepia')).toBe(false);
  });
});
