import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { paths } from '@/config/paths';
import { useCategories } from '@/features/category/api/categories';
import { CategoryDeleteDialog } from '@/features/category/components/category-delete-dialog';
import {
  CategoryRows,
  CategoryRowsSkeleton,
  CategoryTable,
  CategoryTableMessage,
} from '@/features/category/components/category-table';
import { type AdminCategoryListItem } from '@/features/category/model/category';

// S1 of docs/specs/SHOP-81/design.md, the admin category list (US1): the title and Add
// category (S1.2, S1.3), the table (S1.4–S1.8) with its loading, error and empty
// states (S1.9), and the delete dialog S3 that Delete of a row opens. Every category
// comes in one answer, so there is no search, filter or pagination. Outside
// ProtectedRoute: until the login Epic, the basic auth of the host guards admin.
export function CategoryList() {
  const { t } = useTranslation('category');
  const { data, isPending, isError, isFetching, refetch } = useCategories();
  const tableRef = useRef<HTMLDivElement>(null);
  // The category of the open dialog S3, or null while it is closed.
  const [toDelete, setToDelete] = useState<AdminCategoryListItem | null>(null);
  // Set when the dialog closes on a delete: the row and its Delete button are gone.
  const focusTableRef = useRef(false);

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

  function body() {
    if (data === undefined && isError) {
      return (
        <CategoryTableMessage
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
    if (data === undefined) return <CategoryRowsSkeleton />;
    if (data.length === 0) return <CategoryTableMessage role="status" message={t('list.empty')} />;
    return <CategoryRows categories={data} onDelete={setToDelete} />;
  }

  return (
    <section className="list-page">
      <div className="page-header">
        <h1>{t('title')}</h1>
        {/* The one Add category of the page, also when the list is empty (S1.9). */}
        <Link className="btn btn--primary" to={paths.categoryNew.getHref()}>
          {t('actions.add')}
        </Link>
      </div>

      <div className="card list-page__card">
        <CategoryTable ref={tableRef} isBusy={isPending || (isFetching && data === undefined)}>
          {body()}
        </CategoryTable>
      </div>

      <CategoryDeleteDialog
        category={toDelete}
        onCancel={() => {
          setToDelete(null);
        }}
        onDeleted={handleDeleted}
      />
    </section>
  );
}
