import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { VirtualList } from '@/components/virtual/virtual-list';
import { renderWithProviders, screen } from '@/testing/render';

const ITEM_HEIGHT = 35;
const VIEWPORT_HEIGHT = 300;

// jsdom does no layout, so offsetHeight is always 0. @tanstack/react-virtual
// measures via offsetHeight (not getBoundingClientRect), so mock it: rows (which
// carry data-index) report ITEM_HEIGHT; everything else (the scroll viewport)
// reports VIEWPORT_HEIGHT. That gives the virtualizer a real window to compute.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement): number {
      return this.hasAttribute('data-index') ? ITEM_HEIGHT : VIEWPORT_HEIGHT;
    },
  });
});

afterAll(() => {
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  }
});

describe('VirtualList', () => {
  // 5,000 rows — large enough that mounting all of them would hurt. (Array.from
  // over .keys() avoids an unused first callback param under strict ESLint.)
  const items = Array.from(Array(5000).keys(), (index) => `Item ${index}`);

  it('mounts only the visible window, not the whole dataset', () => {
    const { container } = renderWithProviders(
      <VirtualList
        items={items}
        height={VIEWPORT_HEIGHT}
        estimateSize={ITEM_HEIGHT}
        renderItem={(item) => <span>{item}</span>}
      />,
    );

    // First rows are present...
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    // ...a far-off row is NOT (the whole point of virtualization)...
    expect(screen.queryByText('Item 4999')).not.toBeInTheDocument();

    // ...and only a small window is in the DOM, far fewer than 5,000.
    const rows = container.querySelectorAll('[data-index]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
  });
});
