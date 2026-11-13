import { afterEach, describe, expect, it } from 'vitest';

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
  subscribeTokens,
} from './token-storage';

describe('token storage', () => {
  afterEach(() => {
    clearTokens();
  });

  it('sets and reads tokens', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
  });

  it('clears tokens', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r' });
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('notifies subscribers on set + clear; unsubscribe stops', () => {
    let count = 0;
    const unsub = subscribeTokens(() => {
      count += 1;
    });
    setTokens({ accessToken: 'a', refreshToken: 'r' }); // +1
    clearTokens(); // +1
    unsub();
    setTokens({ accessToken: 'b', refreshToken: 'r2' }); // no fire after unsubscribe
    expect(count).toBe(2);
  });
});
