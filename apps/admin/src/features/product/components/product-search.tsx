import { type Ref, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

// The search box of the list, S1.5: a pill with a magnifier, a hidden label and at
// most 100 characters. The keyword reaches the list 300 ms after the last key, so
// the list loads once per keyword rather than once per letter (NFR6). Until then the
// box shows what is typed; after, what the URL holds.

const SEARCH_DELAY_MS = 300;
const MAX_LENGTH = 100;

interface ProductSearchProps {
  /** The keyword of the URL. */
  value: string;
  onSearch: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
}

export function ProductSearch({ value, onSearch, ref }: ProductSearchProps) {
  const { t } = useTranslation('product');
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A keyword still waiting must not reach the URL of another page.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="search">
      <svg
        className="search__icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="m11 11 3.5 3.5" />
      </svg>
      <label className="visually-hidden" htmlFor="product-search">
        {t('filters.searchLabel')}
      </label>
      <input
        ref={ref}
        id="product-search"
        className="input search__input"
        type="search"
        maxLength={MAX_LENGTH}
        placeholder={t('filters.searchPlaceholder')}
        value={draft ?? value}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            onSearch(next);
            setDraft(null);
          }, SEARCH_DELAY_MS);
        }}
      />
    </div>
  );
}
