'use client';

import { SignOutIcon } from '~/components/ui/icons';
import { logoutAction } from '~/features/auth/actions/auth-actions';

/**
 * Nút đăng xuất — `<form action={logoutAction}>` (progressive enhancement). Action xoá cookie phiên
 * + best-effort thu hồi token backend rồi redirect. Đặt trong `AuthStatus` (đã ở `<Suspense>` của
 * layout) nên KHÔNG vướng lỗi blocking-route (Server Action form phải ∈ Suspense — bài học folder 14).
 * Là `.nav-btn` của thanh điều hướng S4.1: biểu tượng (aria-hidden) và chữ, chữ là tên của nút.
 */
export function LogoutButton({ label }: { label: string }) {
  return (
    <form className="nav-account__form" action={logoutAction}>
      <button className="nav-btn" type="submit" title={label}>
        <SignOutIcon className="nav-btn__icon" />
        <span className="nav-btn__label">{label}</span>
      </button>
    </form>
  );
}
