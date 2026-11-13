import { describe, expect, it } from 'vitest';

import { type Permission } from '@/features/auth/model/auth';

import { hasModule, hasPermission } from './permission';

const permissions: Permission[] = [
  { id: 1, name: 'list products', path: '/products', method: 'GET', module: 'product' },
];

// Pure-unit smoke test: proves Vitest runs framework-free unit tests (no DOM).
describe('permission helpers', () => {
  it('hasPermission matches on method + path', () => {
    expect(hasPermission(permissions, 'GET', '/products')).toBe(true);
    expect(hasPermission(permissions, 'POST', '/products')).toBe(false);
    expect(hasPermission(permissions, 'GET', '/orders')).toBe(false);
  });

  it('hasModule matches on module', () => {
    expect(hasModule(permissions, 'product')).toBe(true);
    expect(hasModule(permissions, 'order')).toBe(false);
  });

  it('an empty permission list denies everything', () => {
    expect(hasPermission([], 'GET', '/products')).toBe(false);
    expect(hasModule([], 'product')).toBe(false);
  });
});
