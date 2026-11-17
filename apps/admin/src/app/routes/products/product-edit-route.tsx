import { useParams } from 'react-router';

import { ProductEdit } from '@/features/product/components/product-edit';

// S2 in edit mode (US3), /products/:productId/edit. Thin app-level route: the feature
// loads the product and owns the form. A lazy chunk, like the add form (FM-013).
export function ProductEditRoute() {
  const { productId = '' } = useParams();
  // A new page for each product, so nothing typed for one shows on another.
  return <ProductEdit key={productId} productId={productId} />;
}
