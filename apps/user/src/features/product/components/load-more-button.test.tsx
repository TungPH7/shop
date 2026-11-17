import { Suspense, use, useState, type ReactNode } from 'react';

import { describe, expect, test, vi } from 'vitest';

import { act, renderWithProviders, screen } from '~/testing/render';

// The router of next-intl needs the App Router of Next, which Vitest does not have: the test holds its replace and
// refresh. The navigation itself, its transition and the server render it brings, are in e2e/products.spec.ts.
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('~/i18n/navigation', () => ({ useRouter: () => router }));

import { LoadMoreButton } from './load-more-button';

/** The grid of the page with `count` cards and the button under it, as ProductResults lays them out. */
function Grid({ count, children }: { count: number; children?: ReactNode }) {
  return (
    <>
      <ul id="grid">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <a href={`/vi/products/p-${i + 1}`}>{`Product ${i + 1}`}</a>
          </li>
        ))}
      </ul>
      {children}
    </>
  );
}

describe('<LoadMoreButton />', () => {
  test('replaces the URL with the next page, without scrolling, when pressed (S4.10)', async () => {
    const { user } = renderWithProviders(
      <LoadMoreButton listId="grid" shown={24} nextHref="/products?page=2" failed={false} />,
      { locale: 'vi' },
    );

    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));

    expect(router.replace).toHaveBeenCalledWith('/products?page=2', { scroll: false });
    expect(router.refresh).not.toHaveBeenCalled();
  });

  test('is named in the language of the page', () => {
    renderWithProviders(
      <LoadMoreButton listId="grid" shown={24} nextHref="/products?page=2" failed={false} />,
      { locale: 'en' },
    );

    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('has no button once every product is shown', () => {
    renderWithProviders(
      <LoadMoreButton listId="grid" shown={30} nextHref={null} failed={false} />,
      { locale: 'vi' },
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  test('moves the focus to the first new card once they are shown, even when the button goes', async () => {
    const { user, rerender } = renderWithProviders(
      <Grid count={24}>
        <LoadMoreButton listId="grid" shown={24} nextHref="/products?page=2" failed={false} />
      </Grid>,
      { locale: 'vi' },
    );
    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));

    rerender(
      <Grid count={30}>
        <LoadMoreButton listId="grid" shown={30} nextHref={null} failed={false} />
      </Grid>,
    );

    expect(screen.getByRole('link', { name: 'Product 25' })).toHaveFocus();
  });

  test('leaves the focus alone when the cards change without a press', () => {
    const { rerender } = renderWithProviders(
      <Grid count={24}>
        <LoadMoreButton listId="grid" shown={24} nextHref="/products?page=2" failed={false} />
      </Grid>,
      { locale: 'vi' },
    );

    rerender(
      <Grid count={48}>
        <LoadMoreButton listId="grid" shown={48} nextHref="/products?page=3" failed={false} />
      </Grid>,
    );

    expect(document.body).toHaveFocus();
  });

  test('says it is loading, busy and locked, while the next page is on its way', async () => {
    // A navigation of Next suspends until the server answers, so the transition stays pending. Here the press makes
    // the page suspend on a promise that never settles, which keeps the transition pending the same way.
    const never = new Promise<never>(() => {});
    function Suspends() {
      use(never);
      return null;
    }
    function Page() {
      const [waiting, setWaiting] = useState(false);
      router.replace.mockImplementation(() => setWaiting(true));
      return (
        <Suspense fallback={<p>fallback</p>}>
          {waiting && <Suspends />}
          <LoadMoreButton listId="grid" shown={24} nextHref="/products?page=2" failed={false} />
        </Suspense>
      );
    }
    const { user } = renderWithProviders(<Page />, { locale: 'vi' });

    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));

    const button = screen.getByRole('button', { name: 'Đang tải…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('fallback')).toBeNull();

    // Locked: a second press asks for nothing more.
    router.replace.mockClear();
    await user.click(button);
    expect(router.replace).not.toHaveBeenCalled();
  });

  test.each([
    ['vi', 'Không tải thêm được. Vui lòng thử lại.', 'Xem thêm'],
    ['en', "Couldn't load more. Please try again.", 'Load more'],
  ] as const)(
    'shows the error of S4.10 in %s above a button that still works',
    (locale, message, name) => {
      renderWithProviders(
        <LoadMoreButton listId="grid" shown={24} nextHref="/products?page=2" failed />,
        { locale },
      );

      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('button', { name })).toBeEnabled();
    },
  );

  test('tries the page of the URL again after an error, from the server and not the cache of the router', async () => {
    const { user } = renderWithProviders(
      <LoadMoreButton listId="grid" shown={24} nextHref="/products?page=2" failed />,
      { locale: 'vi' },
    );

    await act(() => user.click(screen.getByRole('button', { name: 'Xem thêm' })));

    expect(router.refresh).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
