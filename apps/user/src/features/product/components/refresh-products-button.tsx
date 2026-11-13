'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { initialRefreshState } from '~/features/product/model/product-actions';
import { refreshProductsAction } from '~/features/product/actions/product-actions';

interface RefreshProductsButtonProps {
  label: string;
  doneLabel: string;
}

/**
 * Nút submit — đọc `pending` của form CHA qua `useFormStatus` (phải nằm TRONG `<form>`). Đây là 1
 * trong 2 cách bắt trạng thái chờ; cách kia (`isPending` từ `useActionState`) xem `DeleteProductButton`.
 */
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {label}
    </button>
  );
}

/**
 * Nút "Làm mới sản phẩm" gọi **Server Action** `refreshProductsAction` qua `<form action={…}>`:
 *  - `useActionState(action, initial)` → `[state, formAction]`; `state` cập nhật khi action trả về.
 *  - **Progressive enhancement**: là `<form>` thật → vẫn submit được kể cả khi JS chưa hydrate.
 *  - Thay cho pattern Route Handler + `fetch` + `router.refresh()` của folder 10 (idiomatic hơn).
 *
 * Nhận label đã localize từ server (page có `getTranslations`) → client KHÔNG cần provider i18n
 * (luật server-first folder 09/10: giải i18n ở server, truyền chuỗi xuống).
 */
export function RefreshProductsButton({ label, doneLabel }: RefreshProductsButtonProps) {
  const [state, formAction] = useActionState(refreshProductsAction, initialRefreshState);

  return (
    <form action={formAction}>
      <SubmitButton label={label} />
      {state.status === 'success' && (
        <span role="status">
          {' '}
          {doneLabel} {state.refreshedAt}
        </span>
      )}
    </form>
  );
}
