import { useSyncExternalStore } from 'react';

import { getSnapshot, subscribe, type Notification } from './notification-store';

// Reactive read of the notification store for the <Notifications/> renderer.
// Same pattern as token-storage + useAccessToken (folder 10): a plain observable
// store made reactive with useSyncExternalStore (the third arg is the SSR
// snapshot — the same empty array on the server).
export function useNotifications(): readonly Notification[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
