// Headless, framework-agnostic notification (toast) store. It is a plain
// observable — subscribe / getSnapshot / mutate — so it can be driven from ANY
// context: React components read it via useSyncExternalStore (use-notifications),
// while non-React call sites (the global Query/Mutation error handlers) push to
// it with a direct `notify.error(...)`.
//
// Why a standalone store and NOT a Redux slice (folder 09): it must be callable
// from outside React with zero ceremony, and it should stay independent of the
// client-state store-swap seam. This mirrors token-storage (folder 10) — a small
// observable made reactive with useSyncExternalStore.

export type NotificationKind = 'error' | 'success' | 'info';

export interface Notification {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly message: string;
}

// Errors linger so the user can actually read them; confirmations clear faster.
const DURATION_MS: Record<NotificationKind, number> = {
  error: 8000,
  success: 4000,
  info: 4000,
};

let nextId = 1;
let notifications: readonly Notification[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Returns a STABLE reference between mutations — required by useSyncExternalStore
// to avoid an infinite render loop (the array identity only changes on a real
// change).
export function getSnapshot(): readonly Notification[] {
  return notifications;
}

export function dismiss(id: number): void {
  const next = notifications.filter((notification) => notification.id !== id);
  if (next.length !== notifications.length) {
    notifications = next;
    emit();
  }
}

export function clearAll(): void {
  if (notifications.length > 0) {
    notifications = [];
    emit();
  }
}

function add(kind: NotificationKind, message: string): number {
  const id = nextId;
  nextId += 1;
  notifications = [...notifications, { id, kind, message }];
  emit();

  // Auto-dismiss. `setTimeout` exists in both browser and Node, so the store
  // stays environment-agnostic; we still guard for exotic runtimes.
  if (typeof setTimeout === 'function') {
    setTimeout(() => {
      dismiss(id);
    }, DURATION_MS[kind]);
  }
  return id;
}

// Imperative API for non-React callers (the global error handlers, etc.).
export const notify = {
  error: (message: string): number => add('error', message),
  success: (message: string): number => add('success', message),
  info: (message: string): number => add('info', message),
} as const;
