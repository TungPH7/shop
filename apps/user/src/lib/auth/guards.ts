import 'server-only';

import { getLocale } from 'next-intl/server';

import { getProfile } from '~/lib/auth/get-profile';
import { hasModule } from '~/lib/auth/permissions';
import { type AuthUser } from '~/lib/auth/profile';
import { redirect } from '~/i18n/navigation';

/**
 * Guard SERVER-FIRST — thay `<ProtectedRoute>` / `<RequireModule>` client của guide React. RSC tự hỏi
 * danh tính rồi `redirect` (không "trang chớp hiện rồi đá ra" như client guard).
 *
 * ⚠️ Chỉ dùng trong component đã ở `<Suspense>` (getProfile đọc cookie ⇒ dynamic; bài học Stage B).
 * `redirect` của next-intl được TS suy ra trả `void` (không `never`) → sau khi gọi cần `throw` để hàm
 * đủ kiểu trả; runtime KHÔNG bao giờ tới `throw` (redirect đã ném NEXT_REDIRECT trước đó).
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getProfile();
  if (user) return user;
  redirect({ href: '/login', locale: await getLocale() });
  throw new Error('unreachable: redirect đã ném');
}

/** requireUser + kiểm quyền theo module (route-level authz). Thiếu module → /forbidden. */
export async function requireModule(module: string): Promise<AuthUser> {
  const user = await requireUser(); // chưa đăng nhập → đã redirect /login
  if (hasModule(user.role.permissions, module)) return user;
  redirect({ href: '/forbidden', locale: await getLocale() });
  throw new Error('unreachable: redirect đã ném');
}
