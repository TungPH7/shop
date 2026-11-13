import { parseAsString, useQueryState } from 'nuqs';

export interface UseProductFiltersResult {
  search: string;
  setSearch: (value: string) => void;
}

// The URL is client state too. This facade wraps nuqs so the product list reads
// and writes the `?q=` search param like local state — but it stays shareable,
// bookmarkable, and survives reload/back-forward. Setting an empty value clears
// the param (keeps the URL clean) by writing `null`.
export function useProductFilters(): UseProductFiltersResult {
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  return {
    search,
    setSearch: (value) => {
      void setSearch(value === '' ? null : value);
    },
  };
}
