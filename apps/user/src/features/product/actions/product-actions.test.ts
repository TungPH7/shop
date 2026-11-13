// @vitest-environment node
// Server Action là hàm async THƯỜNG khi test (directive 'use server' vô hiệu ngoài Next bundler).
// Ta test ORCHESTRATION: validate → re-authz → delegate → updateTag → state; mock các seam (next/cache,
// getCurrentUser, deleteProduct). Chạy ở `node` vì chuỗi import đụng module `server-only`/seam server.
import { expect, test, vi } from 'vitest';

import { updateTag } from 'next/cache';

import {
  deleteProductAction,
  refreshProductsAction,
} from '~/features/product/actions/product-actions';
import {
  initialProductActionState,
  initialRefreshState,
} from '~/features/product/model/product-actions';
import { deleteProduct } from '~/features/product/server/delete-product';
import { getCurrentUser } from '~/lib/auth/get-current-user';
import { ApiError } from '~/lib/http/api-error';

// vitest HOIST các vi.mock này lên trên import → action thấy bản mock.
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('~/lib/auth/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('~/features/product/server/delete-product', () => ({ deleteProduct: vi.fn() }));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedDeleteProduct = vi.mocked(deleteProduct);
const mockedUpdateTag = vi.mocked(updateTag);

function formDataWith(productId: string | null): FormData {
  const fd = new FormData();
  if (productId !== null) fd.set('productId', productId);
  return fd;
}

test('input sai → reason "validation"; KHÔNG re-authz, KHÔNG gọi backend', async () => {
  const state = await deleteProductAction(initialProductActionState, formDataWith('-1'));
  expect(state).toEqual({ status: 'error', reason: 'validation' });
  expect(mockedGetCurrentUser).not.toHaveBeenCalled();
  expect(mockedDeleteProduct).not.toHaveBeenCalled();
});

test('chưa đăng nhập → reason "auth"; KHÔNG gọi backend (secure-by-default)', async () => {
  mockedGetCurrentUser.mockResolvedValue(null);
  const state = await deleteProductAction(initialProductActionState, formDataWith('29'));
  expect(state).toEqual({ status: 'error', reason: 'auth' });
  expect(mockedDeleteProduct).not.toHaveBeenCalled();
  expect(mockedUpdateTag).not.toHaveBeenCalled();
});

test('đã đăng nhập + xoá OK → success + updateTag("products")', async () => {
  mockedGetCurrentUser.mockResolvedValue({ id: 1, role: 'SELLER' });
  mockedDeleteProduct.mockResolvedValue(undefined);
  const state = await deleteProductAction(initialProductActionState, formDataWith('29'));
  expect(state).toEqual({ status: 'success', deletedId: 29 });
  expect(mockedDeleteProduct).toHaveBeenCalledWith(29);
  expect(mockedUpdateTag).toHaveBeenCalledWith('products');
});

test('backend 401 (defense-in-depth) → reason "auth"; KHÔNG updateTag', async () => {
  mockedGetCurrentUser.mockResolvedValue({ id: 1, role: 'SELLER' });
  mockedDeleteProduct.mockRejectedValue(
    new ApiError({ kind: 'http', status: 401, message: 'unauthorized' }),
  );
  const state = await deleteProductAction(initialProductActionState, formDataWith('29'));
  expect(state).toEqual({ status: 'error', reason: 'auth' });
  expect(mockedUpdateTag).not.toHaveBeenCalled();
});

test('refresh → updateTag("products") + success kèm refreshedAt', async () => {
  const state = await refreshProductsAction(initialRefreshState, new FormData());
  expect(mockedUpdateTag).toHaveBeenCalledWith('products');
  expect(state.status).toBe('success');
  if (state.status === 'success') {
    expect(typeof state.refreshedAt).toBe('string');
  }
});
