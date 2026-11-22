import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import {
  type AdminCategory,
  type AdminCategoryListItem,
  adminCategoryListSchema,
  adminCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@/features/category/model/category';
import { api } from '@/lib/api/api';
import { isApiError } from '@/lib/api/api-error';

// The admin API of categories, /api/admin/categories (API Contract of
// docs/specs/SHOP-81/plan.md), for S1, S2 and S3. A write is never retried, by the api
// layer or here (NFR12): `retry.ts` retries only GET, HEAD and OPTIONS.

const BASE = '/admin/categories';

/**
 * Query-key factory of categories (ST-005). Every key starts with `categories`, as the
 * key of the options of the Category field of the product form does (plan,
 * Architecture Decisions 9), so an add, edit or delete refreshes that field too.
 */
export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
  detail: (id: string) => [...categoryKeys.all, 'detail', id] as const,
};

const pathOf = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** Every category, in the order of the api: by name as Vietnamese sorts it (NFR17). */
export async function getCategories(): Promise<AdminCategoryListItem[]> {
  const list = await api.get(BASE, { schema: adminCategoryListSchema });
  return list.items;
}

/** The category S2 edits, a hidden one too, with the version an edit sends back. */
export function getCategory(id: string): Promise<AdminCategory> {
  return api.get(pathOf(id), { schema: adminCategorySchema });
}

/**
 * A 2xx means saved. The form only goes back to the list, so the body is not read: a
 * body the admin cannot parse is no failed save, which would have the admin save again
 * and add the category twice.
 */
export async function createCategory(input: CreateCategoryInput): Promise<void> {
  await api.post(BASE, input);
}

export interface UpdateCategoryVariables {
  id: string;
  input: UpdateCategoryInput;
}

/** A 2xx means saved, as for an add: the body is not read. */
export async function updateCategory({ id, input }: UpdateCategoryVariables): Promise<void> {
  await api.put(pathOf(id), input);
}

/**
 * 204, even when the category is already gone (NFR12). A 404 is the same thing (S3.7):
 * the category is gone either way.
 */
export async function deleteCategory(id: string): Promise<void> {
  try {
    await api.delete(pathOf(id));
  } catch (error) {
    if (isApiError(error) && error.kind === 'http' && error.status === 404) return;
    throw error;
  }
}

/**
 * Whether the category is not there: a 404, never made or deleted, or a 400 of an id
 * that is no UUID, which no category has. S2 shows its not-found state (S2.3), which
 * Try again would never change.
 */
export function isCategoryMissing(error: unknown): boolean {
  return (
    isApiError(error) && error.kind === 'http' && (error.status === 404 || error.status === 400)
  );
}

/** The fields of the form that show an error of the api under them, in their order on it. */
export const CATEGORY_FORM_FIELDS = ['name', 'slug'] as const;
export type CategoryFormField = (typeof CATEGORY_FORM_FIELDS)[number];

/** How the form shows a failed save ("Cách admin hiện lỗi" of the API Contract). */
export type CategoryFormFailure =
  /** 400: "This value isn't valid." under each field the api names, the first focused. */
  | { kind: 'fields'; fields: CategoryFormField[] }
  /** 409 CATEGORY_NAME_DUPLICATED: under the name, focused (S2.5, AC4). */
  | { kind: 'nameTaken' }
  /** 409 CATEGORY_SLUG_DUPLICATED of a slug the form sent (S2.6, AC4). */
  | { kind: 'slugTaken' }
  /** 409 CATEGORY_SLUG_DUPLICATED of slug null: every generated slug is taken (S2.6). */
  | { kind: 'slugNotGenerated' }
  /** 409 OPTIMISTIC_LOCK_CONFLICT: the conflict banner of S2.4, nothing written. */
  | { kind: 'conflict' }
  /** 404 of an edit: deleted in another tab; the not-found state of S2.3. */
  | { kind: 'notFound' }
  /** Network, timeout, 5xx, a 400 of no field of the form, or anything else (S2.4). */
  | { kind: 'general' };

const validationProblemSchema = z.object({
  errors: z.array(z.object({ field: z.string() })),
});

function fieldErrorsOf(error: unknown): CategoryFormField[] {
  if (!isApiError(error) || error.kind !== 'http' || error.status !== 400) return [];
  const problem = validationProblemSchema.safeParse(error.details);
  const named = new Set(problem.success ? problem.data.errors.map((item) => item.field) : []);
  return CATEGORY_FORM_FIELDS.filter((field) => named.has(field));
}

/**
 * The failure of a save, add or edit. Branches on the status and the code of the error,
 * never on its message. `slug` is the slug the form sent: null only for an add whose
 * slug the api generates.
 */
export function categoryFailureOf(error: unknown, slug: string | null): CategoryFormFailure {
  if (isApiError(error) && error.kind === 'http') {
    if (error.status === 409) {
      if (error.code === 'CATEGORY_NAME_DUPLICATED') return { kind: 'nameTaken' };
      if (error.code === 'CATEGORY_SLUG_DUPLICATED') {
        return slug === null ? { kind: 'slugNotGenerated' } : { kind: 'slugTaken' };
      }
      if (error.code === 'OPTIMISTIC_LOCK_CONFLICT') return { kind: 'conflict' };
    }
    if (error.status === 404) return { kind: 'notFound' };
  }
  const fields = fieldErrorsOf(error);
  return fields.length > 0 ? { kind: 'fields', fields } : { kind: 'general' };
}

export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: categoryKeys.list(),
    queryFn: getCategories,
    // The table shows its own error with Try again (S1.4): no toast on top.
    meta: { skipGlobalError: true },
  });
}

export function useCategories() {
  return useQuery(categoriesQueryOptions());
}

export function categoryQueryOptions(id: string) {
  return queryOptions({
    queryKey: categoryKeys.detail(id),
    queryFn: () => getCategory(id),
    // The form edits the version it opened with: only Reload loads a newer one, so no
    // refetch on focus or on reconnect. Opened again, it loads the category anew.
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // The page shows a missing category itself (S2.3): no toast on top.
    meta: { skipGlobalError: true },
  });
}

export function useCategory(id: string) {
  return useQuery(categoryQueryOptions(id));
}

/** After a write: every query of categories, the options of the product form too. */
function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: categoryKeys.all });
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: createCategory,
    // The form shows every error itself (S2.4–S2.6): no global toast on top.
    meta: { skipGlobalError: true },
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: updateCategory,
    meta: { skipGlobalError: true },
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: deleteCategory,
    // The dialog shows the error itself (S3.7): no global toast on top.
    meta: { skipGlobalError: true },
    onSuccess: invalidate,
  });
}
