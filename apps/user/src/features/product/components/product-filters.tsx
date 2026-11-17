'use client';

import {
  useId,
  useOptimistic,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { SearchIcon } from '~/components/ui/icons';
import {
  MAX_KEYWORD_LENGTH,
  parseProductQuery,
  searchHref,
  sortHref,
  sortsFor,
  type ProductQuery,
} from '~/features/product/model/product-query';
import { getPathname, useRouter } from '~/i18n/navigation';

/**
 * The search S4.3 and the sort S4.4 of the products page (design.md of SHOP-7), one row above the grid; under 768px,
 * one above the other. Styles: `.product-filters`, `.search` in src/styles/components.css.
 *
 * Both go through the URL, the source of truth of S4 (plan of SHOP-7, Architecture Decisions 10 and 11), and back to
 * the first 24 products:
 *
 * - The search is a `<form role=search>` of method GET on the products page, so it works without JavaScript too. With
 *   it, Enter navigates in a transition to the URL the browser would build, through `searchHref`: the keyword cleaned
 *   as the page reads it, and a sort the visitor chose, which the form also holds in a hidden field.
 * - The sort is a native `<select>` with a visible label, applied as soon as it changes, without scrolling. Relevance
 *   is an option only while searching (AC20). While the new products are on their way, the select shows the choice.
 * - The field shows the keyword of the URL (AC18), and follows it when the URL changes, as after Clear search (S4.8).
 */
export function ProductFilters({ query }: { query: ProductQuery }) {
  const t = useTranslations('Products');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  const [sort, showSort] = useOptimistic(query.sort);
  const [keyword, setKeyword] = useState(query.q);
  const [keywordOfUrl, setKeywordOfUrl] = useState(query.q);
  if (keywordOfUrl !== query.q) {
    setKeywordOfUrl(query.q);
    setKeyword(query.q);
  }

  // A sort the visitor chose: in the URL, so in the form; the default of the search is not.
  const chosenSort = parseProductQuery({ q: query.q }).sort === query.sort ? null : query.sort;

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => router.push(searchHref(query, keyword)));
  };

  const changeSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = parseProductQuery({ q: query.q, sort: event.target.value }).sort;
    startTransition(() => {
      showSort(next);
      router.push(sortHref(query, next), { scroll: false });
    });
  };

  return (
    <div className="product-filters">
      <form
        role="search"
        method="get"
        action={getPathname({ href: '/products', locale })}
        className="search product-filters__search"
        onSubmit={search}
      >
        <SearchIcon className="search__icon" />
        <label className="visually-hidden" htmlFor={`${id}-q`}>
          {t('searchLabel')}
        </label>
        <input
          id={`${id}-q`}
          className="input search__input"
          type="search"
          name="q"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('searchPlaceholder')}
          maxLength={MAX_KEYWORD_LENGTH}
          enterKeyHint="search"
          autoComplete="off"
        />
        {chosenSort !== null && <input type="hidden" name="sort" value={chosenSort} />}
      </form>
      <div className="product-filters__sort">
        <label className="label product-filters__sort-label" htmlFor={`${id}-sort`}>
          {t('sortLabel')}
        </label>
        <select id={`${id}-sort`} className="input" value={sort} onChange={changeSort}>
          {sortsFor(query.q).map((option) => (
            <option key={option} value={option}>
              {t(`sort.${option}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
