import { type Ref, useId } from 'react';

import { useTranslation } from 'react-i18next';

import { SelectField } from '@/components/ui/field';
import { type CategoryOption } from '@/features/product/model/product';

// The Category field of the product form, S4.2 of docs/specs/SHOP-81/design.md: a native
// <select> with No category first, then every category in the order of the api, a
// hidden one with "(Hidden)" in its text, not only in a color. While the options load,
// or when they fail to load, the field is locked; the form locks Save the same way,
// since it cannot send a category it does not know. The name of a category shows as
// text, as every name does (NFR10 of SHOP-81). Each time the admin opens the field, by
// the pointer or by the keyboard, it asks for the options again, so a category added in
// another tab shows without a reload; meanwhile it keeps the options it has, open and free.

interface ProductCategoryFieldProps {
  /** The id of the category picked, or '' for No category. */
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  ref: Ref<HTMLSelectElement>;
  /** The options once loaded; undefined while they load or failed to load. */
  options: readonly CategoryOption[] | undefined;
  /** True when the options failed to load and none are there: the error of S4.2. */
  loadFailed: boolean;
  onRetry: () => void;
  /** Called when the admin opens the field: the form loads the options again. */
  onOpen: () => void;
  /** The error under the field, such as a category deleted in another tab (AC10). */
  error: string | undefined;
}

export function ProductCategoryField({
  value,
  onChange,
  onBlur,
  name,
  ref,
  options,
  loadFailed,
  onRetry,
  onOpen,
  error,
}: ProductCategoryFieldProps) {
  const { t } = useTranslation('product');
  const loadFailedId = useId();
  const isLoading = options === undefined && !loadFailed;

  return (
    <div>
      <SelectField
        ref={ref}
        name={name}
        label={t('form.category.label')}
        hint={t('form.category.hint')}
        error={error}
        aria-describedby={loadFailed ? loadFailedId : undefined}
        value={options === undefined ? '' : value}
        disabled={options === undefined}
        aria-busy={isLoading || undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onBlur={onBlur}
        // A click on a field that has the focus already opens it without a focus event.
        onPointerDown={onOpen}
        onFocus={onOpen}
      >
        {isLoading ? (
          <option value="">{t('form.category.loading')}</option>
        ) : (
          <>
            <option value="">{t('form.category.none')}</option>
            {(options ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.status === 'HIDDEN'
                  ? t('form.category.hiddenOption', { name: option.name })
                  : option.name}
              </option>
            ))}
          </>
        )}
      </SelectField>
      {/* The error of S4.2, with Try again: the banner of the form, read out at once. */}
      {loadFailed ? (
        <div className="banner banner--error" role="alert">
          <p id={loadFailedId}>{t('form.category.loadFailed')}</p>
          <button
            type="button"
            className="btn btn--secondary btn--sm banner__action"
            onClick={onRetry}
          >
            {t('form.category.retry')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
