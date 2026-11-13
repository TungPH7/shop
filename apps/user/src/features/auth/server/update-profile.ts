import 'server-only';

import {
  updateProfileResSchema,
  type UpdateProfileInput,
} from '~/features/auth/model/profile-form';
import { authHeaders } from '~/lib/auth/auth-headers';
import { httpPut } from '~/lib/http/client';

/**
 * DAL cập nhật hồ sơ (BFF) — `PUT /profile` (`@ApiBearerAuth`): backend dùng userId trong token →
 * user chỉ sửa được hồ sơ CỦA MÌNH. `server-only`. `authHeaders()` đính Bearer (đọc cookie NGOÀI cache).
 */
export async function updateProfile(
  input: UpdateProfileInput,
): Promise<{ id: number; name: string }> {
  return httpPut('/profile', updateProfileResSchema, {
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(input),
  });
}
