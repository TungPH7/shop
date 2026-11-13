import { ProductList } from '@/features/product/components/product-list';

// Thin app-level route: it only composes the feature's component. The feature
// owns its UI and logic; the app layer just wires it into the route tree.
export function ProductsRoute() {
  return <ProductList />;
}
