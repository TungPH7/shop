import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './msw/server';
import { testI18n } from './test-i18n';

// jsdom lacks a few browser APIs some libraries touch — polyfill the common one
// (matchMedia) so component tests don't crash on it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }),
});

// jsdom has no ResizeObserver; @tanstack/react-virtual (folder 17, <VirtualList>)
// constructs one to watch its scroll element. A no-op stub is enough: the
// virtualizer also measures synchronously via offsetHeight (which virtual-list.
// test.tsx mocks) on mount and on each row's ref, so it never needs a resize event.
class ResizeObserverStub {
  observe(): void {
    /* no-op */
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// MSW: mock the network for the whole suite; fail loudly on any unhandled request
// so a missing handler is obvious instead of a silent hang.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup(); // unmount React trees (RTL auto-cleanup needs globals; we import explicitly)
  server.resetHandlers();
  localStorage.clear();
  void testI18n.changeLanguage('en'); // reset language between tests
});

afterAll(() => {
  server.close();
});
