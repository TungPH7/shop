import { expect, test } from 'vitest';

import { profileSchema } from '~/lib/auth/profile';

// Shape THẬT backend trả (GetUserProfileResSchema) — nhiều field hơn DTO ta cần.
const BACKEND_PROFILE = {
  id: 1,
  email: 'admin@shop.com',
  name: 'Admin',
  phoneNumber: '',
  avatar: null,
  status: 'ACTIVE',
  role: {
    id: 2,
    name: 'ADMIN',
    permissions: [
      {
        id: 9,
        name: 'Delete product',
        description: '',
        module: 'MANAGE-PRODUCT',
        path: '/manage-product/products/:productId',
        method: 'DELETE',
      },
    ],
  },
};

test('profileSchema: parse OK + BỎ field thừa (DTO tối thiểu)', () => {
  const r = profileSchema.safeParse(BACKEND_PROFILE);
  expect(r.success).toBe(true);
  if (r.success) {
    expect(r.data).toEqual({
      id: 1,
      email: 'admin@shop.com',
      name: 'Admin',
      phoneNumber: '', // folder 16: DTO mở rộng thêm phoneNumber + avatar (form sửa hồ sơ cần)
      avatar: null,
      role: {
        name: 'ADMIN',
        permissions: [
          {
            module: 'MANAGE-PRODUCT',
            path: '/manage-product/products/:productId',
            method: 'DELETE',
          },
        ],
      },
    });
    expect('status' in r.data).toBe(false); // field thừa (status) vẫn bị strip → DTO tối thiểu
  }
});

test('profileSchema: thiếu role → fail (validate ở biên bắt drift)', () => {
  expect(profileSchema.safeParse({ id: 1, email: 'a@b.com', name: 'X' }).success).toBe(false);
});
