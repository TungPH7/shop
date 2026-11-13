import { expect, test, vi } from 'vitest';

import { LoginForm } from '~/features/auth/components/login-form';
import { renderWithProviders, screen } from '~/testing/render';

// Mock action → KHÔNG kéo server code (login DAL / next/headers) vào test client island (smoke).
vi.mock('~/features/auth/actions/auth-actions', () => ({ loginAction: vi.fn() }));

const labels = {
  email: 'Email',
  password: 'Password',
  submit: 'Sign in',
  submitting: 'Signing in…',
};

test('render form đăng nhập: ô email + password + nút submit', () => {
  renderWithProviders(<LoginForm labels={labels} errorMessages={{}} />);
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});
