import {
  createParser,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

import {
  PRODUCT_STATUS_FILTERS,
  type ProductListFilters,
  type ProductStatusFilter,
} from '@/features/product/model/product';

// The URL state of the admin list (S1.4, S1.5, S1.11; plan, Architecture Decisions
// 11): `/products?q=&status=all|active|hidden&page=N`. The URL is the source of
// truth, so a reload or the same link in another tab shows the same list (AC4).
// A wrong value falls back to its default, with no error (S1.11); a default value
// leaves the URL.

// A page is a whole number from 1, written as digits only: "2.5", "0" or "-2" are
// not pages.
const parseAsPage = createParser({
  parse: (value: string) => (/^[1-9]\d*$/.test(value) ? Number(value) : null),
  serialize: (page: number) => String(page),
});

const filterParsers = {
  q: parseAsString.withDefault(''),
  status: parseAsStringLiteral(PRODUCT_STATUS_FILTERS).withDefault('all'),
  page: parseAsPage.withDefault(1),
};

const serializeFilters = createSerializer(filterParsers);

export function useProductFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers);

  return {
    filters: filters satisfies ProductListFilters,
    /** S1.4: a new status starts again from page 1. */
    setStatus: (status: ProductStatusFilter) => {
      void setFilters({ status: status === 'all' ? null : status, page: null });
    },
    /** S1.5: a new keyword starts again from page 1; a blank one leaves the URL. */
    setSearch: (q: string) => {
      void setFilters({ q: q.trim() === '' ? null : q, page: null });
    },
    /** S1.10: back to every product. */
    clearFilters: () => {
      void setFilters({ q: null, status: null, page: null });
    },
    /** S1.11: the link of a page, keeping the keyword and the status. */
    hrefForPage: (page: number) => ({
      search: serializeFilters({ q: filters.q, status: filters.status, page }),
    }),
  };
}
