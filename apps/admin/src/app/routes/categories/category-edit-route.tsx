import { useParams } from 'react-router';

import { CategoryEdit } from '@/features/category/components/category-edit';

// S2 of docs/specs/SHOP-81/design.md in edit mode, /categories/:categoryId/edit. Thin
// app-level route: the feature loads the category and owns the form. A lazy chunk.
export function CategoryEditRoute() {
  const { categoryId = '' } = useParams();
  // A new page for each category, so nothing typed for one shows on another.
  return <CategoryEdit key={categoryId} categoryId={categoryId} />;
}
