import { Link, useParams } from 'react-router';

import { paths } from '@/config/paths';
import { useProduct } from '@/features/product/api/get-product';
import { ProductEditForm } from '@/features/product/components/product-edit-form';
import { isApiError } from '@/lib/api/api-error';
import { invariant } from '@/utils/assert';

// App route (reachable only through the RBAC module guard in the route table):
// fetch the product, then hand it to the product-feature edit form. The app layer
// is the only place allowed to wire auth-gated routing around a feature.
export function ProductEditRoute() {
  const { productId } = useParams();
  invariant(productId, 'productId route param is required');

  const { data: product, isPending, isError, error } = useProduct(productId);

  if (isPending) {
    return <p role="status">Loading product…</p>;
  }
  if (isError) {
    return (
      <section>
        <h2>Could not load product</h2>
        <p role="alert">{isApiError(error) ? error.message : 'Unknown error'}</p>
        <Link to={paths.products.getHref()}>Back to products</Link>
      </section>
    );
  }

  return (
    <section>
      <h2>Edit {product.name}</h2>
      <ProductEditForm product={product} />
    </section>
  );
}
