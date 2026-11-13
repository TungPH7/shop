'use client';

import { logoutAction } from '~/features/auth/actions/auth-actions';

/**
 * Nút đăng xuất — `<form action={logoutAction}>` (progressive enhancement). Action xoá cookie phiên
 * + best-effort thu hồi token backend rồi redirect. Đặt trong `AuthStatus` (đã ở `<Suspense>` của
 * layout) nên KHÔNG vướng lỗi blocking-route (Server Action form phải ∈ Suspense — bài học folder 14).
 */
export function LogoutButton({ label }: { label: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit">{label}</button>
    </form>
  );
}
