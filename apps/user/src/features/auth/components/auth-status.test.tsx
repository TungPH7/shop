import { type ComponentProps } from 'react';

import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import vi_ from '../../../../messages/vi.json';

// AuthStatus is an async Server Component: awaited, it gives an element RTL renders. The session is a stub, the strings
// are the real Vietnamese ones, the Link of next-intl is a plain <a>, and the logout Server Action is a stub.
const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: null as null | { role: string } },
}));
vi.mock('~/lib/auth/get-current-user', () => ({ getCurrentUser: () => currentUser.value }));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'Auth') =>
    Promise.resolve(createTranslator({ locale: 'vi', messages: vi_, namespace })),
}));
vi.mock('~/i18n/navigation', () => ({
  Link: ({ href, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={`/vi${href}`} {...props} />
  ),
}));
vi.mock('~/features/auth/actions/auth-actions', () => ({ logoutAction: vi.fn() }));

import { AuthStatus } from './auth-status';

describe('<AuthStatus />', () => {
  beforeEach(() => {
    currentUser.value = null;
  });

  it('links a visitor to the sign-in page, with an icon hidden from assistive tech', async () => {
    renderWithProviders(await AuthStatus(), { locale: 'vi' });

    const link = screen.getByRole('link', { name: 'Đăng nhập' });
    expect(link).toHaveAttribute('href', '/vi/login');
    expect(link).toHaveClass('nav-btn');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives a signed-in person the account link, the role and a sign-out button', async () => {
    currentUser.value = { role: 'ADMIN' };
    renderWithProviders(await AuthStatus(), { locale: 'vi' });

    expect(screen.getByRole('link', { name: 'Tài khoản' })).toHaveAttribute('href', '/vi/account');
    expect(screen.getByText('Đã đăng nhập (ADMIN)')).toBeInTheDocument();
    const signOut = screen.getByRole('button', { name: 'Đăng xuất' });
    expect(signOut).toHaveAttribute('type', 'submit');
    expect(signOut.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
