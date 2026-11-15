import { useTranslation } from 'react-i18next';

// Pagination of a list (S1.11): "Showing 1–20 of 25", Previous, the page numbers,
// Next. Controlled: the caller owns the page (the ?page= of the URL) and gets
// onPageChange(page). Hidden when everything fits on one page.
// Previous and Next are locked with aria-disabled rather than disabled, so a keyboard
// user who reaches the last page with Next keeps focus on the button.
// Up to seven pages are all listed. A longer list keeps the first and last pages and
// one page on each side of the current one; an ellipsis never hides a single page.

interface PaginationProps {
  /** The current page, from 1. A page past the end counts as the last one. */
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

const MAX_FULL_LIST = 7;

type PageItem = { kind: 'page'; page: number } | { kind: 'gap'; after: number };

function pageItems(current: number, pageCount: number): PageItem[] {
  if (pageCount <= MAX_FULL_LIST) {
    return Array.from({ length: pageCount }, (_, index) => ({ kind: 'page', page: index + 1 }));
  }

  const pages = [1, current - 1, current, current + 1, pageCount]
    .filter((page) => page >= 1 && page <= pageCount)
    .filter((page, index, all) => all.indexOf(page) === index)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  let previous = 0;
  for (const page of pages) {
    if (page - previous === 2) items.push({ kind: 'page', page: previous + 1 });
    else if (page - previous > 2) items.push({ kind: 'gap', after: previous });
    items.push({ kind: 'page', page });
    previous = page;
  }
  return items;
}

export function Pagination({ page, pageSize, totalItems, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.ceil(totalItems / pageSize);

  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalItems);
  const isFirst = current === 1;
  const isLast = current === pageCount;

  function goTo(target: number) {
    if (target !== current && target >= 1 && target <= pageCount) onPageChange(target);
  }

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <p className="pagination__summary">
        {t('pagination.summary', { from, to, total: totalItems })}
      </p>
      <ul className="pagination__list">
        <li>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            aria-disabled={isFirst || undefined}
            onClick={() => {
              goTo(current - 1);
            }}
          >
            {t('pagination.previous')}
          </button>
        </li>
        {pageItems(current, pageCount).map((item) =>
          item.kind === 'gap' ? (
            <li key={`gap-${item.after}`} className="pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item.page}>
              <button
                type="button"
                className="btn btn--secondary btn--sm pagination__page"
                aria-label={t('pagination.page', { page: item.page })}
                aria-current={item.page === current ? 'page' : undefined}
                onClick={() => {
                  goTo(item.page);
                }}
              >
                {item.page}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            aria-disabled={isLast || undefined}
            onClick={() => {
              goTo(current + 1);
            }}
          >
            {t('pagination.next')}
          </button>
        </li>
      </ul>
    </nav>
  );
}
