import { configureStore } from '@reduxjs/toolkit';

import { loadTheme, saveTheme } from '@/stores/persistence';
import { themeReducer } from '@/stores/theme/theme-slice';

// Root state shape derived from the slice reducers (avoids a store<->type cycle).
export interface RootState {
  theme: ReturnType<typeof themeReducer>;
}

// Factory so tests can build a fresh, isolated store (mirrors createApiClient /
// createQueryClient). `preloadedState` seeds slices, e.g. the persisted theme.
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: { theme: themeReducer },
    preloadedState,
  });
}

// Singleton: hydrate the theme slice from localStorage (if present + valid).
const persistedTheme = loadTheme();
export const store = makeStore(persistedTheme ? { theme: { theme: persistedTheme } } : undefined);

export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];

// Persist theme ONLY when it actually changes (minimal writes — Vercel
// `client-localstorage-schema`).
let lastTheme = store.getState().theme.theme;
store.subscribe(() => {
  const next = store.getState().theme.theme;
  if (next !== lastTheme) {
    lastTheme = next;
    saveTheme(next);
  }
});
