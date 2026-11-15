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

// Every toast stays 6 s (design.md, S1.12), and the countdown stops while the person
// hovers or focuses the toasts (pauseTimers / resumeTimers, called by <Notifications>),
// so a toast is never gone while it is being read (WCAG 2.2.1).
const DURATION_MS = 6000;

interface Timer {
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | undefined;
}

let nextId = 1;
let notifications: readonly Notification[] = [];
const timers = new Map<number, Timer>();
let paused = false;
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

function startTimer(id: number, timer: Timer): void {
  timer.startedAt = Date.now();
  timer.handle = setTimeout(() => {
    dismiss(id);
  }, timer.remaining);
}

// Stops every countdown, keeping the time each toast has left.
export function pauseTimers(): void {
  if (paused) return;
  paused = true;
  for (const timer of timers.values()) {
    clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  }
}

// Starts every countdown again with the time it had left.
export function resumeTimers(): void {
  if (!paused) return;
  paused = false;
  for (const [id, timer] of timers) startTimer(id, timer);
}

export function dismiss(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer.handle);
    timers.delete(id);
  }
  const next = notifications.filter((notification) => notification.id !== id);
  if (next.length !== notifications.length) {
    notifications = next;
    emit();
  }
}

export function clearAll(): void {
  for (const timer of timers.values()) clearTimeout(timer.handle);
  timers.clear();
  paused = false;
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

  // Auto-dismiss, unless the toasts are paused: then the countdown starts on resume.
  const timer: Timer = { remaining: DURATION_MS, startedAt: Date.now(), handle: undefined };
  timers.set(id, timer);
  if (!paused) startTimer(id, timer);
  return id;
}

// Imperative API for non-React callers (the global error handlers, etc.).
export const notify = {
  error: (message: string): number => add('error', message),
  success: (message: string): number => add('success', message),
  info: (message: string): number => add('info', message),
} as const;
