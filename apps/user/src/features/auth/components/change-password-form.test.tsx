import { expect, test, vi } from 'vitest';

import { ChangePasswordForm } from '~/features/auth/components/change-password-form';
import { renderWithProviders, screen } from '~/testing/render';

// Mock action (không kéo server code). Form này KHÔNG dùng useRouter (success → reset(), không refresh).
vi.mock('~/features/auth/actions/profile-actions', () => ({ changePasswordAction: vi.fn() }));

const labels = {
  password: 'Current password',
  newPassword: 'New password',
  confirmNewPassword: 'Confirm new password',
  submit: 'Change password',
  submitting: 'Changing…',
  saved: 'Password changed.',
};

test('render form đổi mật khẩu: 3 ô mật khẩu + nút submit', () => {
  renderWithProviders(<ChangePasswordForm labels={labels} errorMessages={{}} />);
  expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  expect(screen.getByLabelText('New password')).toBeInTheDocument();
  expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
});
