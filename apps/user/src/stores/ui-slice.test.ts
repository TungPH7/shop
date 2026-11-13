import { describe, expect, it } from 'vitest';

import { setDensity, toggleDensity, uiReducer } from '~/stores/ui-slice';

// Reducer THUẦN → test trực tiếp (không cần store/Provider). Logic state = nơi dễ test nhất.
describe('uiSlice', () => {
  it('mặc định = comfortable', () => {
    expect(uiReducer(undefined, { type: '@@INIT' })).toEqual({ density: 'comfortable' });
  });

  it('toggleDensity đổi qua lại', () => {
    const compact = uiReducer(undefined, toggleDensity());
    expect(compact.density).toBe('compact');
    expect(uiReducer(compact, toggleDensity()).density).toBe('comfortable');
  });

  it('setDensity đặt giá trị tường minh', () => {
    expect(uiReducer(undefined, setDensity('compact')).density).toBe('compact');
  });
});
