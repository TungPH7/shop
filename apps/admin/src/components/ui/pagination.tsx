import { type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';
import { type To, useHref, useLinkClickHandler } from 'react-router';

// Pagination of a list (S1.11): "Showing 1–20 of 25", Previous, the page numbers,
// Next. Hidden when everything fits on one page.
// Changing page is navigation (UI-001): every item is a link to the URL of its page,
// built by the caller with hrefFor(page), so a page opens in a new tab or is copied
// (AC4). The URL stays the source of truth; the caller reads the page back from it.
// Previous and Next on the first and last page are locked links: an <a> without href,
// with aria-disabled and tabIndex 0. They stay the same element as the live link, so a
// keyboard user who reaches the last page with Next keeps focus on it.
// Up to seven pages are all listed. A longer list keeps the first and last pages and
// one page on each side of the current one; an ellipsis never hides a single page.

interface PaginationProps {
  /**
   * The current page, from 1. The caller reads it from ?page= once and passes a valid
   * page (S1.11). As a guard, anything else (past the last page, NaN, 0, 2.5) shows as
   * page 1, the same rule, so the range never says NaN.
   */
  page: number;
  pageSize: number;
  totalItems: number;
  /** The URL of a page, keeping the other parameters of the list: `?q=…&page=3`. */
  hrefFor: (page: number) => To;
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

interface PageLinkProps {
  to: To;
  isLocked?: boolean;
  className: string;
  'aria-label'?: string | undefined;
  'aria-current'?: 'page' | undefined;
  children: ReactNode;
}

// One <a> whether it is live or locked, so React keeps the node and its focus.
function PageLink({ to, isLocked = false, children, ...attributes }: PageLinkProps) {
  const href = useHref(to);
  const handleClick = useLinkClickHandler<HTMLAnchorElement>(to);

  if (isLocked) {
    return (
      <a role="link" aria-disabled="true" tabIndex={0} {...attributes}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} onClick={handleClick} {...attributes}>
      {children}
    </a>
  );
}

export function Pagination({ page, pageSize, totalItems, hrefFor }: PaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.ceil(totalItems / pageSize);

  if (pageCount <= 1) return null;

  const current = Number.isInteger(page) && page >= 1 && page <= pageCount ? page : 1;
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalItems);
  const isFirst = current === 1;
  const isLast = current === pageCount;

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <p className="pagination__summary">
        {t('pagination.summary', { from, to, total: totalItems })}
      </p>
      <ul className="pagination__list">
        <li>
          <PageLink
            to={hrefFor(isFirst ? current : current - 1)}
            isLocked={isFirst}
            className="btn btn--secondary btn--sm"
          >
            {t('pagination.previous')}
          </PageLink>
        </li>
        {pageItems(current, pageCount).map((item) =>
          item.kind === 'gap' ? (
            <li key={`gap-${item.after}`} className="pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item.page}>
              <PageLink
                to={hrefFor(item.page)}
                className="btn btn--secondary btn--sm pagination__page"
                aria-label={t('pagination.page', { page: item.page })}
                aria-current={item.page === current ? 'page' : undefined}
              >
                {item.page}
              </PageLink>
            </li>
          ),
        )}
        <li>
          <PageLink
            to={hrefFor(isLast ? current : current + 1)}
            isLocked={isLast}
            className="btn btn--secondary btn--sm"
          >
            {t('pagination.next')}
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}
