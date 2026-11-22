import { CategoryList } from '@/features/category/components/category-list';

// S1 of docs/specs/SHOP-81/design.md, /categories. Thin app-level route: the feature
// owns the list and its delete dialog S3. A lazy chunk, like the product pages.
export function CategoriesRoute() {
  return <CategoryList />;
}
