import { type ReactNode } from 'react';

import { Provider } from 'react-redux';

import { type AppStore, store as defaultStore } from '@/stores/store';

interface StoreProviderProps {
  children: ReactNode;
  /** Override the store — tests pass a fresh, isolated `makeStore()` so each
      test starts clean. App code omits it and gets the singleton. */
  store?: AppStore;
}

// The single react-redux <Provider> wiring. Kept inside src/stores so the app
// layer composes `<StoreProvider>` without importing react-redux itself — the
// store implementation stays behind the stores boundary.
export function StoreProvider({ children, store = defaultStore }: StoreProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}
