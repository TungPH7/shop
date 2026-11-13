import { useState } from 'react';
import { useNavigate } from 'react-router';

import { paths } from '@/config/paths';
import { useDeleteProduct } from '@/features/product/api/delete-product';
import { isApiError } from '@/lib/api/api-error';

interface ProductDeleteButtonProps {
  productId: string;
}

// Headless delete with an inline two-step confirm (no window.confirm → testable
// and no UI lib). On success navigates back to the product list.
export function ProductDeleteButton({ productId }: ProductDeleteButtonProps) {
  const navigate = useNavigate();
  const deleteProduct = useDeleteProduct();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  }

  return (
    <span role="group" aria-label="Confirm delete">
      Delete this product?{' '}
      <button
        type="button"
        disabled={deleteProduct.isPending}
        onClick={() =>
          deleteProduct.mutate(productId, {
            onSuccess: () => {
              void navigate(paths.products.getHref());
            },
          })
        }
      >
        {deleteProduct.isPending ? 'Deleting…' : 'Yes, delete'}
      </button>{' '}
      <button type="button" onClick={() => setConfirming(false)}>
        Cancel
      </button>
      {deleteProduct.isError ? (
        <p role="alert">
          {isApiError(deleteProduct.error)
            ? deleteProduct.error.message
            : 'Failed to delete product'}
        </p>
      ) : null}
    </span>
  );
}
