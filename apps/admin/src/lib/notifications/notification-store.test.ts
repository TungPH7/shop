import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAll,
  dismiss,
  getSnapshot,
  notify,
  pauseTimers,
  resumeTimers,
  subscribe,
} from './notification-store';

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

  it('auto-dismisses every kind after 6 seconds (S1.12)', () => {
    vi.useFakeTimers();
    notify.error('e');
    notify.success('s');
    notify.info('i');
    vi.advanceTimersByTime(5999);
    expect(getSnapshot()).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(getSnapshot()).toHaveLength(0);
  });

  it('stops the countdown while paused and finishes the rest of it on resume', () => {
    vi.useFakeTimers();
    notify.success('Product added');
    vi.advanceTimersByTime(4000);

    pauseTimers();
    vi.advanceTimersByTime(60_000);
    expect(getSnapshot()).toHaveLength(1);

    resumeTimers();
    vi.advanceTimersByTime(1999);
    expect(getSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getSnapshot()).toHaveLength(0);
  });

  it('holds a notification added while paused until resume', () => {
    vi.useFakeTimers();
    pauseTimers();
    notify.info('x');
    vi.advanceTimersByTime(60_000);
    expect(getSnapshot()).toHaveLength(1);

    resumeTimers();
    vi.advanceTimersByTime(6000);
    expect(getSnapshot()).toHaveLength(0);
  });

  it('ignores a second pause and a resume without a pause', () => {
    vi.useFakeTimers();
    resumeTimers();
    notify.info('x');
    pauseTimers();
    pauseTimers();
    resumeTimers();
    vi.advanceTimersByTime(6000);
    expect(getSnapshot()).toHaveLength(0);
  });

  it('forgets the timer of a notification dismissed by hand', () => {
    vi.useFakeTimers();
    const id = notify.info('x');
    pauseTimers();
    dismiss(id);
    resumeTimers();
    notify.info('y');
    vi.advanceTimersByTime(6000);
    expect(getSnapshot()).toHaveLength(0);
  });
});
