import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/ui/dialog';
import { useDeleteCategory } from '@/features/category/api/categories';
import { type AdminCategoryListItem } from '@/features/category/model/category';
import { notify } from '@/lib/notifications/notification-store';

// S3 of docs/specs/SHOP-81/design.md, the confirmation before a category is deleted for
// good (AC7, AC8). The Dialog of the design system gives the modal, the first focus on
// Cancel, Esc as Cancel and the focus back on the Delete button of the row (S1.8).
// The warning of S3.4 shows only when the category still has products: their count is
// the one of the list, read when the page loaded (S1.6), not read again. Deleting never
// deletes a product; each becomes No category. Deleted: the list reloads, then
// "Category deleted" (S1.10) and onDeleted. Failed, by network, timeout or 5xx: the
// dialog stays with the error of S3.7, and the DELETE of the api is idempotent.

interface CategoryDeleteDialogProps {
  /** The category to delete; null while the dialog is closed. */
  category: Pick<AdminCategoryListItem, 'id' | 'name' | 'productCount'> | null;
  /** Cancel, Close or Esc: the caller closes the dialog, and the category stays. */
  onCancel: () => void;
  /** The category is gone and the list reloaded: the caller closes the dialog. */
  onDeleted: () => void;
}

function WarningIcon() {
  return (
    <svg className="banner__icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        d="M9 2 16.5 15H1.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 7v3.5M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CategoryDeleteDialog({ category, onCancel, onDeleted }: CategoryDeleteDialogProps) {
  const { t } = useTranslation('category');
  const { mutate, isPending, isError, reset } = useDeleteCategory();

  function handleCancel() {
    // The next category opens without the error of this one.
    reset();
    onCancel();
  }

  function handleDelete() {
    if (category === null || isPending) return;
    mutate(category.id, {
      onSuccess: () => {
        notify.success(t('delete.done'));
        reset();
        onDeleted();
      },
    });
  }

  const productCount = category?.productCount ?? 0;

  return (
    <Dialog
      open={category !== null}
      title={t('delete.title', { name: category?.name })}
      cancelLabel={t('delete.cancel')}
      onCancel={handleCancel}
      isBusy={isPending}
      error={isError ? t('delete.failed') : undefined}
      action={
        <button
          type="button"
          className="btn btn--danger"
          aria-disabled={isPending || undefined}
          onClick={handleDelete}
        >
          {isPending ? t('delete.deleting') : t('delete.confirm')}
        </button>
      }
    >
      <p>{t('delete.cannotUndo')}</p>
      {productCount > 0 ? (
        <div className="banner banner--warn">
          <WarningIcon />
          <p>{t('delete.products', { count: productCount })}</p>
        </div>
      ) : null}
      <p>{t('delete.hideHint')}</p>
    </Dialog>
  );
}
