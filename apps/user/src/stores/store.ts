import { configureStore } from '@reduxjs/toolkit';

import { uiReducer } from '~/stores/ui-slice';

/**
 * `makeStore` — tạo MỚI mỗi request (KHÔNG singleton): khi SSR, một singleton sẽ rò state giữa các
 * request khác nhau. Provider (`store-provider.tsx`) gọi 1 lần/instance.
 *
 * ⚠️ Luật folder 14: global store CHỈ chứa **client/UI state thuần** — KHÔNG nhét data server vào đây
 * để tự sync (đó là việc của RSC/TanStack Query → trộn lẫn = nguồn bug lớn).
 */
export function makeStore() {
  return configureStore({
    reducer: { ui: uiReducer },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
