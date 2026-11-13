import 'server-only';

import { messageResponseSchema } from '~/features/auth/model/auth';
import { type ChangePasswordInput } from '~/features/auth/model/profile-form';
import { authHeaders } from '~/lib/auth/auth-headers';
import { httpPut } from '~/lib/http/client';

/**
 * DAL đổi mật khẩu (BFF) — `PUT /profile/change-password` (`@ApiBearerAuth`): backend kiểm mật khẩu
 * hiện tại (`password`) + đặt `newPassword`. `server-only`. Bearer qua `authHeaders()`. Trả `{ message }`.
 */
export async function changePassword(input: ChangePasswordInput): Promise<{ message: string }> {
  return httpPut('/profile/change-password', messageResponseSchema, {
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(input),
  });
}
