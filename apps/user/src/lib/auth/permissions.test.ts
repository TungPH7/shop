import { expect, test } from 'vitest';

import { hasModule, hasPermission } from '~/lib/auth/permissions';
import { type Permission } from '~/lib/auth/profile';

const PERMS: Permission[] = [
  { method: 'DELETE', path: '/manage-product/products/:productId', module: 'MANAGE-PRODUCT' },
  { method: 'GET', path: '/profile', module: 'PROFILE' },
];

test('hasPermission: khớp CẢ method + path', () => {
  expect(hasPermission(PERMS, 'DELETE', '/manage-product/products/:productId')).toBe(true);
  expect(hasPermission(PERMS, 'GET', '/manage-product/products/:productId')).toBe(false); // sai method
  expect(hasPermission(PERMS, 'DELETE', '/other')).toBe(false); // sai path
});

test('hasModule: khớp module bất kỳ quyền nào', () => {
  expect(hasModule(PERMS, 'MANAGE-PRODUCT')).toBe(true);
  expect(hasModule(PERMS, 'PROFILE')).toBe(true);
  expect(hasModule(PERMS, 'ORDERS')).toBe(false);
});

test('mảng quyền rỗng → luôn false', () => {
  expect(hasPermission([], 'DELETE', '/x')).toBe(false);
  expect(hasModule([], 'PROFILE')).toBe(false);
});
