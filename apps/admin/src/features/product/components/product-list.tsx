import { useRef } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Pagination } from '@/components/ui/pagination';
import { SegmentedFilter } from '@/components/ui/segmented-control';
import { paths } from '@/config/paths';
import { PRODUCTS_PAGE_SIZE, useProducts } from '@/features/product/api/get-products';
import { ProductSearch } from '@/features/product/components/product-search';
import {
  ProductRows,
  ProductRowsSkeleton,
  ProductTable,
  ProductTableMessage,
} from '@/features/product/components/product-table';
import { useProductFilters } from '@/features/product/hooks/use-product-filters';
import { PRODUCT_STATUS_FILTERS } from '@/features/product/model/product';

// S1 of docs/specs/SHOP-7/design.md, the admin product list (US1): the title and
// Add product (S1.2, S1.3), the status filter with its count (S1.4), the search box
// (S1.5), the table (S1.6, S1.7) with its empty states (S1.9, S1.10), and the
// pagination (S1.11). Every filter lives in the URL (AC4). Outside ProtectedRoute:
// until the login Epic, the basic auth of the host guards admin (AC1).
export function ProductList() {
  const { t } = useTranslation('product');
  const { filters, setStatus, setSearch, clearFilters, hrefForPage } = useProductFilters();
  const { data, isPending, isError, isPlaceholderData, refetch } = useProducts(filters);
  const searchRef = useRef<HTMLInputElement>(null);
  const isFiltered = filters.q.trim() !== '' || filters.status !== 'all';

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
    if (data === undefined) return <ProductRowsSkeleton />;
    if (data.items.length > 0) return <ProductRows products={data.items} />;
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
            {data === undefined ? '' : t('filters.count', { count: data.totalItems })}
          </p>
        </div>
        <ProductSearch ref={searchRef} value={filters.q} onSearch={setSearch} />
      </div>

      <div className="card list-page__card">
        <ProductTable isBusy={isPending || isPlaceholderData}>{body()}</ProductTable>
        {data === undefined ? null : (
          <Pagination
            page={data.offset / PRODUCTS_PAGE_SIZE + 1}
            pageSize={PRODUCTS_PAGE_SIZE}
            totalItems={data.totalItems}
            hrefFor={hrefForPage}
          />
        )}
      </div>
    </section>
  );
}
