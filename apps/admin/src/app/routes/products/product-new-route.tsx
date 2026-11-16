import { ProductForm } from '@/features/product/components/product-form';

// S2 in add mode (US2), /products/new. Thin app-level route: the feature owns the form.
// A lazy chunk, so react-hook-form loads only with the form (FM-013).
export function ProductNewRoute() {
  return <ProductForm />;
}
