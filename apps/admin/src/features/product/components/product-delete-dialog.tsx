import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/ui/dialog';
import { useDeleteProduct } from '@/features/product/api/delete-product';
import { type AdminProductSummary } from '@/features/product/model/product';
import { notify } from '@/lib/notifications/notification-store';

// S3 of docs/specs/SHOP-7/design.md, the confirmation before a product is deleted for
// good (US4: AC14, AC15). The Dialog of the design system gives the modal, the first
// focus on Cancel, Esc as Cancel and the focus back on the Delete button of the row
// (S1.8). Deleted: the list of every page reloads, then "Product deleted" (S1.12) and
// onDeleted. Failed, by network, timeout or 5xx: the dialog stays with the error of
// S3.6, and the person presses Delete again; the DELETE of the api is idempotent.

interface ProductDeleteDialogProps {
  /** The product to delete; null while the dialog is closed. */
  product: Pick<AdminProductSummary, 'id' | 'name'> | null;
  /** Cancel, Close or Esc: the caller closes the dialog, and the product stays. */
  onCancel: () => void;
  /** The product is gone and the list reloaded: the caller closes the dialog. */
  onDeleted: () => void;
}

export function ProductDeleteDialog({ product, onCancel, onDeleted }: ProductDeleteDialogProps) {
  const { t } = useTranslation('product');
  const { mutate, isPending, isError, reset } = useDeleteProduct();

  function handleCancel() {
    // The next product opens without the error of this one.
    reset();
    onCancel();
  }

  function handleDelete() {
    if (product === null || isPending) return;
    mutate(product.id, {
      onSuccess: () => {
        notify.success(t('delete.done'));
        reset();
        onDeleted();
      },
    });
  }

  return (
    <Dialog
      open={product !== null}
      title={t('delete.title', { name: product?.name })}
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
      <p>{t('delete.hideHint')}</p>
    </Dialog>
  );
}
