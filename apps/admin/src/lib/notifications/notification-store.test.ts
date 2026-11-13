import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAll, dismiss, getSnapshot, notify, subscribe } from './notification-store';

describe('notification store', () => {
  beforeEach(() => {
    clearAll();
  });
  afterEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  it('adds notifications readable via getSnapshot', () => {
    notify.error('boom');
    expect(getSnapshot()).toHaveLength(1);
    expect(getSnapshot()[0]?.kind).toBe('error');
    expect(getSnapshot()[0]?.message).toBe('boom');
  });

  it('dismiss removes by id', () => {
    const id = notify.info('hi');
    dismiss(id);
    expect(getSnapshot()).toHaveLength(0);
  });

  it('subscribe fires on change; unsubscribe stops', () => {
    let count = 0;
    const unsub = subscribe(() => {
      count += 1;
    });
    const id = notify.success('a'); // +1
    dismiss(id); // +1
    unsub();
    notify.error('b'); // no fire after unsubscribe
    expect(count).toBe(2);
  });

  it('getSnapshot returns a stable reference until a change (useSyncExternalStore)', () => {
    const before = getSnapshot();
    expect(getSnapshot()).toBe(before);
    notify.info('x');
    expect(getSnapshot()).not.toBe(before);
  });

  it('auto-dismisses after the per-kind duration', () => {
    vi.useFakeTimers();
    notify.error('e'); // 8000ms
    notify.info('i'); // 4000ms
    expect(getSnapshot()).toHaveLength(2);
    vi.advanceTimersByTime(4000);
    expect(getSnapshot()).toHaveLength(1); // info gone
    vi.advanceTimersByTime(4000);
    expect(getSnapshot()).toHaveLength(0); // error gone
  });
});
