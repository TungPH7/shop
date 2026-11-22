import { CategoryForm } from '@/features/category/components/category-form';

// S2 of docs/specs/SHOP-81/design.md in add mode, /categories/new. Thin app-level route:
// the feature owns the form. A lazy chunk, so react-hook-form loads only with a form.
export function CategoryNewRoute() {
  return <CategoryForm />;
}
