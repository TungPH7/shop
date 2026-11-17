import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Pagination } from '@/components/ui/pagination';
import { SegmentedFilter } from '@/components/ui/segmented-control';
import { paths } from '@/config/paths';
import { PRODUCTS_PAGE_SIZE, useProducts } from '@/features/product/api/get-products';
import { ProductDeleteDialog } from '@/features/product/components/product-delete-dialog';
import { ProductSearch } from '@/features/product/components/product-search';
import {
  ProductRows,
  ProductRowsSkeleton,
  ProductTable,
  ProductTableMessage,
} from '@/features/product/components/product-table';
import { useProductFilters } from '@/features/product/hooks/use-product-filters';
import { type AdminProductSummary, PRODUCT_STATUS_FILTERS } from '@/features/product/model/product';

// S1 of docs/specs/SHOP-7/design.md, the admin product list (US1): the title and
// Add product (S1.2, S1.3), the status filter with its count (S1.4), the search box
// (S1.5), the table (S1.6, S1.7, S1.8) with its empty states (S1.9, S1.10), the
// pagination (S1.11), and the delete dialog S3 that Delete of a row opens (US4). Every filter lives in the URL (AC4). Outside ProtectedRoute:
// until the login Epic, the basic auth of the host guards admin (AC1).
export function ProductList() {
  const { t } = useTranslation('product');
  const { filters, setStatus, setSearch, clearFilters, hrefForPage } = useProductFilters();
  const { data, isPending, isError, isPlaceholderData, refetch } = useProducts(filters);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  // The product of the open dialog S3, or null while it is closed.
  const [toDelete, setToDelete] = useState<AdminProductSummary | null>(null);
  // Set when the dialog closes on a delete: the row and its Delete button are gone.
  const focusTableRef = useRef(false);
  const isFiltered = filters.q.trim() !== '' || filters.status !== 'all';
  // An empty placeholder is the page of the last filters, not of these: the next
  // filters may have products, so until their own answer the list shows the skeleton
  // and no count, as on the first load, never an empty state.
  const shown = isPlaceholderData && data?.items.length === 0 ? undefined : data;

  // Closed on a delete: focus goes to the table, not to <body>. A Cancel leaves it to
  // the dialog, which gives it back to the Delete button of the row (S3.1). This runs
  // after the dialog's own clean-up, which is an unmount, so it has the last word.
  useEffect(() => {
    if (toDelete === null && focusTableRef.current) {
      focusTableRef.current = false;
      tableRef.current?.focus();
    }
  }, [toDelete]);

  function handleDeleted() {
    focusTableRef.current = true;
    setToDelete(null);
  }

  function handleClearFilters() {
    clearFilters();
    searchRef.current?.focus();
  }

  function body() {
    if (data === undefined && isError) {
      return (
        <ProductTableMessage
          role="alert"
          message={t('list.error')}
          action={
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => void refetch()}
            >
              {t('list.retry')}
            </button>
          }
        />
      );
    }
    if (shown === undefined) return <ProductRowsSkeleton />;
    if (shown.items.length > 0)
      return <ProductRows products={shown.items} onDelete={setToDelete} />;
    if (isFiltered) {
      return (
        <ProductTableMessage
          role="status"
          message={t('list.noMatch')}
          action={
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleClearFilters}
            >
              {t('filters.clear')}
            </button>
          }
        />
      );
    }
    return (
      <ProductTableMessage
        role="status"
        message={t('list.empty')}
        action={
          <Link className="btn btn--primary" to={paths.productNew.getHref()}>
            {t('actions.add')}
          </Link>
        }
      />
    );
  }

  return (
    <section className="list-page">
      <div className="page-header">
        <h1>{t('title')}</h1>
        <Link className="btn btn--primary" to={paths.productNew.getHref()}>
          {t('actions.add')}
        </Link>
      </div>

      <div className="toolbar">
        <div className="toolbar__group">
          <SegmentedFilter
            label={t('filters.statusLabel')}
            options={PRODUCT_STATUS_FILTERS.map((value) => ({
              value,
              label: t(`filters.${value}`),
            }))}
            value={filters.status}
            onChange={setStatus}
          />
          <p className="toolbar__count" role="status">
            {shown === undefined ? '' : t('filters.count', { count: shown.totalItems })}
          </p>
        </div>
        <ProductSearch ref={searchRef} value={filters.q} onSearch={setSearch} />
      </div>

      <div className="card list-page__card">
        <ProductTable ref={tableRef} isBusy={isPending || isPlaceholderData}>
          {body()}
        </ProductTable>
        {shown === undefined ? null : (
          <Pagination
            page={shown.offset / PRODUCTS_PAGE_SIZE + 1}
            pageSize={PRODUCTS_PAGE_SIZE}
            totalItems={shown.totalItems}
            hrefFor={hrefForPage}
          />
        )}
      </div>

      <ProductDeleteDialog
        product={toDelete}
        onCancel={() => {
          setToDelete(null);
        }}
        onDeleted={handleDeleted}
      />
    </section>
  );
}
