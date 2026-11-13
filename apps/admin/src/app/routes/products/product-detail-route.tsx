import { Link, useParams } from 'react-router';

import { paths } from '@/config/paths';
import { Can } from '@/features/auth/components/can';
import { ProductDeleteButton } from '@/features/product/components/product-delete-button';
import { ProductDetail } from '@/features/product/components/product-detail';
import { invariant } from '@/utils/assert';

// App-level composition: ProductDetail (product feature) stays unaware of the auth
// feature. The auth-gated Edit/Delete actions are injected HERE — the app layer is
// the only layer allowed to import BOTH features (import boundary, folder 05). This
// is how cross-feature UI composes without breaking layering.
export function ProductDetailRoute() {
  const { productId } = useParams();
  invariant(productId, 'productId route param is required');

  return (
    <ProductDetail
      actions={
        <>
          <Can method="PUT" path="/products">
            <Link to={paths.productEdit.getHref(productId)}>Edit</Link>
          </Can>{' '}
          <Can method="DELETE" path="/products">
            <ProductDeleteButton productId={productId} />
          </Can>
        </>
      }
    />
  );
}
