import { type ReactNode, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { paths } from '@/config/paths';
import { isCategoryMissing, useCategory } from '@/features/category/api/categories';
import { CategoryForm } from '@/features/category/components/category-form';

// S2 of docs/specs/SHOP-81/design.md in edit mode: loads the category, with the
// skeleton, the not-found and the load-failed states of S2.3, then the form for it.
//
// The form edits the version loaded when the page opened. A new load, on Reload of the
// conflict banner (S2.4) or on Try again, mounts a new form for the new version: what
// was typed is dropped only then.

/** The back link (S2.2) and the card of the page, around any state of S2.3. */
function EditFrame({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  const { t } = useTranslation('category');
  return (
    <section className="form-page">
      <Link className="form-page__back" to={paths.categories.getHref()}>
        <span aria-hidden="true">←</span>
        {t('form.back')}
      </Link>
      <div
        className="card product-form"
        {...(busy ? { role: 'region', 'aria-busy': true, 'aria-label': t('form.loading') } : {})}
      >
        {children}
      </div>
    </section>
  );
}

/** S2.3 while the category loads: the title, then each field as a label over its box. */
function EditSkeleton() {
  return (
    <EditFrame busy>
      <span className="skeleton product-form__skeleton-title" />
      <span className="skeleton product-form__skeleton-text" />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index}>
          <span className="skeleton product-form__skeleton-label" />
          <span className="skeleton product-form__skeleton-input" />
        </div>
      ))}
    </EditFrame>
  );
}

/** A state of the page in place of the form: its message, and what to do next. */
function EditMessage({
  role,
  message,
  action,
}: {
  role: 'status' | 'alert';
  message: string;
  action: ReactNode;
}) {
  const { t } = useTranslation('category');
  return (
    <EditFrame>
      <header className="product-form__header">
        <h1>{t('form.editTitle')}</h1>
      </header>
      <p className="product-form__message" role={role}>
        {message}
      </p>
      <div className="product-form__actions product-form__actions--start">{action}</div>
    </EditFrame>
  );
}

export function CategoryEdit({ categoryId }: { categoryId: string }) {
  const { t } = useTranslation('category');
  const { data, error, isFetching, isFetchedAfterMount, dataUpdatedAt, refetch } =
    useCategory(categoryId);
  // Set when a save answers 404: the category was deleted in another tab (S2.4).
  const [deleted, setDeleted] = useState(false);
  const reload = () => void refetch();

  if (deleted || isCategoryMissing(error)) {
    return (
      <EditMessage
        role="status"
        message={t('form.notFound')}
        action={
          <Link className="btn btn--secondary" to={paths.categories.getHref()}>
            {t('form.backToList')}
          </Link>
        }
      />
    );
  }
  // A category cached by an earlier visit may be an older version: wait for this one.
  if (isFetching || !isFetchedAfterMount) return <EditSkeleton />;
  if (data === undefined || error !== null) {
    return (
      <EditMessage
        role="alert"
        message={t('form.loadFailed')}
        action={
          <button type="button" className="btn btn--secondary" onClick={reload}>
            {t('form.retry')}
          </button>
        }
      />
    );
  }
  return (
    <CategoryForm
      // Each load is a new form, its fields those of the version just loaded.
      key={dataUpdatedAt}
      category={data}
      onMissing={() => {
        setDeleted(true);
      }}
      onReload={reload}
    />
  );
}
