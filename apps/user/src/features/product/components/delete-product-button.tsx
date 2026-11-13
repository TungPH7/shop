'use client';

import { useActionState } from 'react';

import {
  type DeleteFailureReason,
  initialProductActionState,
} from '~/features/product/model/product-actions';
import { deleteProductAction } from '~/features/product/actions/product-actions';

interface DeleteProductButtonProps {
  productId: number;
  label: string;
  /** Copy đã localize cho từng lý do thất bại (server map sẵn → client chỉ tra cứu). */
  messages: Record<DeleteFailureReason, string>;
}

/**
 * Nút "Xoá" gọi **Server Action** `deleteProductAction`. `productId` đi kèm qua `<input hidden>`
 * (vào FormData) — và action vẫn **validate + re-authorize lại ở server** (client gửi gì cũng KHÔNG
 * tin). Dùng `isPending` (phần tử thứ 3 của `useActionState`) để khoá nút khi đang chạy — khác cách
 * `useFormStatus` ở `RefreshProductsButton`.
 *
 * Action TRẢ `ProductActionState` (không ném) → hiện lỗi inline (`role="alert"`). Hiện chưa có auth
 * → action trả `reason: 'auth'` → người dùng thấy thông báo "cần đăng nhập" (folder 15 nối nốt).
 */
export function DeleteProductButton({ productId, label, messages }: DeleteProductButtonProps) {
  const [state, formAction, isPending] = useActionState(
    deleteProductAction,
    initialProductActionState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit" disabled={isPending}>
        {label}
      </button>
      {state.status === 'error' && <span role="alert"> {messages[state.reason]}</span>}
      {state.status === 'success' && <span role="status"> ✓</span>}
    </form>
  );
}
