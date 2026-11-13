import { NextResponse } from 'next/server';

import { refreshSession } from '~/lib/auth/refresh-session';

/**
 * Route Handler refresh-rotation. ĐÂY (không phải RSC) là nơi refresh HỢP LỆ: Route Handler SET được
 * cookie. `POST` (đổi trạng thái — xoay token), không `GET`. Đặt NGOÀI `[locale]` (proxy loại `/api`).
 *  - 204: xoay token thành công (cookie đã niêm phong lại bằng cặp mới).
 *  - 401: không có phiên / refresh thất bại (đã dùng/hết hạn) → client nên điều hướng /login.
 */
export async function POST() {
  const refreshed = await refreshSession();
  if (refreshed) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
}
