// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { updateProfile } from '~/features/auth/server/update-profile';
import { ApiError } from '~/lib/http/api-error';
import { server } from '~/testing/msw/server';

// authHeaders đọc cookie (next/headers) → mock để test DAL ở node (như get-profile/login DAL).
vi.mock('~/lib/auth/auth-headers', () => ({
  authHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));

const URL = 'https://api.example.test/profile';
const INPUT = { name: 'An', phoneNumber: '', avatar: '' };

test('PUT /profile OK → { id, name } (DTO tối thiểu, bỏ field thừa)', async () => {
  server.use(
    http.put(URL, () =>
      HttpResponse.json({
        id: 1,
        email: 'a@b.com',
        name: 'An',
        phoneNumber: '',
        avatar: null,
        status: 'ACTIVE',
        roleId: 2,
      }),
    ),
  );
  await expect(updateProfile(INPUT)).resolves.toEqual({ id: 1, name: 'An' });
});

test('401 → ApiError (http)', async () => {
  server.use(http.put(URL, () => new HttpResponse(null, { status: 401 })));
  await expect(updateProfile(INPUT)).rejects.toBeInstanceOf(ApiError);
});
