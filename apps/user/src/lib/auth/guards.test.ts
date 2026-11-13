// @vitest-environment node
import { expect, test, vi } from 'vitest';

import { getProfile } from '~/lib/auth/get-profile';
import { requireModule, requireUser } from '~/lib/auth/guards';
import { redirect } from '~/i18n/navigation';

vi.mock('~/lib/auth/get-profile', () => ({ getProfile: vi.fn() }));
// redirect THẬT ném NEXT_REDIRECT → mock ném sentinel để assert "đã redirect" + tham số.
vi.mock('~/i18n/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));
vi.mock('next-intl/server', () => ({ getLocale: vi.fn().mockResolvedValue('en') }));

const ADMIN = {
  id: 1,
  email: 'a@b.com',
  name: 'A',
  phoneNumber: '',
  avatar: null,
  role: {
    name: 'ADMIN',
    permissions: [
      { module: 'MANAGE-PRODUCT', path: '/manage-product/products/:productId', method: 'DELETE' },
    ],
  },
};
const CLIENT = {
  id: 2,
  email: 'c@b.com',
  name: 'C',
  phoneNumber: '',
  avatar: null,
  role: { name: 'CLIENT', permissions: [{ module: 'PROFILE', path: '/profile', method: 'GET' }] },
};

test('requireUser: chưa đăng nhập → redirect /login', async () => {
  vi.mocked(getProfile).mockResolvedValue(null);
  await expect(requireUser()).rejects.toThrow('REDIRECT');
  expect(vi.mocked(redirect)).toHaveBeenCalledWith({ href: '/login', locale: 'en' });
});

test('requireUser: đã đăng nhập → trả user', async () => {
  vi.mocked(getProfile).mockResolvedValue(ADMIN);
  await expect(requireUser()).resolves.toEqual(ADMIN);
});

test('requireModule: thiếu module → redirect /forbidden', async () => {
  vi.mocked(getProfile).mockResolvedValue(CLIENT);
  await expect(requireModule('MANAGE-PRODUCT')).rejects.toThrow('REDIRECT');
  expect(vi.mocked(redirect)).toHaveBeenCalledWith({ href: '/forbidden', locale: 'en' });
});

test('requireModule: có module → trả user', async () => {
  vi.mocked(getProfile).mockResolvedValue(ADMIN);
  await expect(requireModule('MANAGE-PRODUCT')).resolves.toEqual(ADMIN);
});
