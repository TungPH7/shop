'use client';

import { useEffect, useRef, useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { useRouter } from '~/i18n/navigation';

/**
 * Load more, S4.10 (design.md of SHOP-7): a navigation, not a fetch of the browser (plan of SHOP-7, Architecture
 * Decisions 10). A press replaces the URL with the next page in a transition, without scrolling and without a new entry
 * in the history; the server renders `page × 24` products again, and the products already shown stay where they are.
 * The URL is the source of truth, so a reload shows the same products.
 *
 * - While the next page is on its way, the transition is pending: "Đang tải…", `aria-busy` and locked. The button keeps
 *   the focus, since `aria-disabled` does not take it away as `disabled` would.
 * - Once the new cards are shown, the focus moves to the first of them. This component stays mounted when the last page
 *   hides the button, so it still moves the focus then.
 * - `failed`: the server could not read the page of the URL and shows the one before (ProductResults). The error line
 *   sits above the button, and a press asks the server for the page of the URL again, past the cache of the router.
 */
export function LoadMoreButton({
  listId,
  shown,
  nextHref,
  failed,
}: {
  /** The id of the `<ul>` of the cards. */
  listId: string;
  /** How many cards the grid shows. */
  shown: number;
  /** The path of the next page; `null` once every product is shown. */
  nextHref: string | null;
  failed: boolean;
}) {
  const t = useTranslations('Products');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  /** The number of cards when the button was pressed: the index of the first new card. */
  const firstNew = useRef<number | null>(null);

  useEffect(() => {
    const index = firstNew.current;
    if (index === null || shown <= index) return;
    firstNew.current = null;
    document.getElementById(listId)?.querySelectorAll<HTMLElement>(':scope > li a')[index]?.focus();
  }, [listId, shown]);

  if (nextHref === null) return null;

  const load = () => {
    if (isPending) return;
    firstNew.current = shown;
    startTransition(() => {
      if (failed) router.refresh();
      else router.replace(nextHref, { scroll: false });
    });
  };

  return (
    <>
      {failed && !isPending && (
        <p role="alert" className="load-more__error">
          {t('loadMoreError')}
        </p>
      )}
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={load}
        aria-busy={isPending || undefined}
        aria-disabled={isPending || undefined}
      >
        {t(isPending ? 'loading' : 'loadMore')}
      </button>
    </>
  );
}
