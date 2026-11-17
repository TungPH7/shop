import { type ReactNode, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { paths } from '@/config/paths';
import { isProductMissing, useProduct } from '@/features/product/api/get-product';
import { ProductForm } from '@/features/product/components/product-form';

// S2 of docs/specs/SHOP-7/design.md in edit mode (US3): loads the product, with the
// skeleton and the not-found state of S2.3, then the form of US2 for it.
//
// The form edits the version loaded when the page opened. A new load, on Reload of the
// conflict banner (AC13) or on Try again, mounts a new form for the new version: what
// was typed is dropped only then.

/** The back link (S2.2) and the card of the page, around any state of S2.3. */
function EditFrame({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  const { t } = useTranslation('product');
  return (
    <section className="form-page">
      <Link className="form-page__back" to={paths.products.getHref()}>
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

/** S2.3 while the product loads: the title, then each field as a label over its box. */
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
      <div className="product-form__pair">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index}>
            <span className="skeleton product-form__skeleton-label" />
            <span className="skeleton product-form__skeleton-input" />
          </div>
        ))}
      </div>
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
  const { t } = useTranslation('product');
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

export function ProductEdit({ productId }: { productId: string }) {
  const { t } = useTranslation('product');
  const { data, error, isFetching, isFetchedAfterMount, dataUpdatedAt, refetch } =
    useProduct(productId);
  // Set when a save answers 404: the product was deleted after it was loaded.
  const [deleted, setDeleted] = useState(false);
  const reload = () => void refetch();

  if (deleted || isProductMissing(error)) {
    return (
      <EditMessage
        role="status"
        message={t('form.notFound')}
        action={
          <Link className="btn btn--secondary" to={paths.products.getHref()}>
            {t('form.backToList')}
          </Link>
        }
      />
    );
  }
  // A product cached by an earlier visit may be an older version: wait for this one.
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
    <ProductForm
      // Each load is a new form, its fields those of the version just loaded.
      key={dataUpdatedAt}
      product={data}
      onMissing={() => {
        setDeleted(true);
      }}
      onReload={reload}
    />
  );
}
