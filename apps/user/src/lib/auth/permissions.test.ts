import { expect, test } from 'vitest';

import { hasModule } from '~/lib/auth/permissions';
import { type Permission } from '~/lib/auth/profile';

const PERMS: Permission[] = [
  { method: 'DELETE', path: '/manage-product/products/:productId', module: 'MANAGE-PRODUCT' },
  { method: 'GET', path: '/profile', module: 'PROFILE' },
];

test('hasModule: khớp module bất kỳ quyền nào', () => {
  expect(hasModule(PERMS, 'MANAGE-PRODUCT')).toBe(true);
  expect(hasModule(PERMS, 'PROFILE')).toBe(true);
  expect(hasModule(PERMS, 'ORDERS')).toBe(false);
});

test('mảng quyền rỗng → luôn false', () => {
  expect(hasModule([], 'PROFILE')).toBe(false);
});
