'use client';

import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '~/stores/hooks';
import { type Density, setDensity, toggleDensity } from '~/stores/ui-slice';

/**
 * ⭐ FACADE hướng-domain (seam S1). Feature dùng `useDensity()` — KHÔNG chạm `react-redux`/RTK trực
 * tiếp (ESLint cấm import 2 lib đó ngoài `src/stores/**`). Đổi implementation RTK → Zustand = viết lại
 * NỘI BỘ `src/stores/*`, giữ NGUYÊN chữ ký hook này ⇒ component (DensityToggle/DensityScope) không sửa.
 */
export function useDensity(): {
  density: Density;
  toggle: () => void;
  set: (value: Density) => void;
} {
  const density = useAppSelector((state) => state.ui.density);
  const dispatch = useAppDispatch();
  return {
    density,
    toggle: useCallback(() => dispatch(toggleDensity()), [dispatch]),
    set: useCallback((value: Density) => dispatch(setDensity(value)), [dispatch]),
  };
}
