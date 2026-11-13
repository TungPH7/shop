'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { Provider } from 'react-redux';

import { makeStore } from '~/stores/store';
import { type Density, setDensity } from '~/stores/ui-slice';

const DENSITY_KEY = 'ui.density';
const isDensity = (value: unknown): value is Density =>
  value === 'comfortable' || value === 'compact';

/**
 * Provider seam S1 (`'use client'`). `useState(() => makeStore())` → store tạo 1 LẦN/instance
 * (per-request khi SSR, KHÔNG singleton → không rò giữa request). Bọc `{children}`: children vẫn là
 * Server Component (giữ server-first — boundary client chỉ là cái Provider mỏng này).
 *
 * ⭐ Persist localStorage SSR-AN-TOÀN (bài học hydration folder 01): KHÔNG đọc localStorage lúc render
 * (server không có → render đầu = mặc định = KHỚP HTML server → không mismatch). SAU mount mới đọc +
 * dispatch (áp giá trị đã lưu) + subscribe ghi lại khi đổi.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => makeStore());

  useEffect(() => {
    const saved = localStorage.getItem(DENSITY_KEY);
    if (isDensity(saved)) {
      store.dispatch(setDensity(saved));
    }
    return store.subscribe(() => {
      localStorage.setItem(DENSITY_KEY, store.getState().ui.density);
    });
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
