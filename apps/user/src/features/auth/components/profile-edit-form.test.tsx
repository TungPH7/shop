import { expect, test, vi } from 'vitest';

import { ProfileEditForm } from '~/features/auth/components/profile-edit-form';
import { renderWithProviders, screen } from '~/testing/render';

// Mock action (không kéo server code) + ~/i18n/navigation (useRouter cần router context — bài học folder 09).
vi.mock('~/features/auth/actions/profile-actions', () => ({ updateProfileAction: vi.fn() }));
vi.mock('~/i18n/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const labels = {
  name: 'Name',
  phoneNumber: 'Phone number',
  avatar: 'Avatar URL',
  submit: 'Save changes',
  submitting: 'Saving…',
  saved: 'Profile saved.',
};

test('render form prefilled (RHF defaultValues) + nút submit', () => {
  renderWithProviders(
    <ProfileEditForm
      defaultValues={{ name: 'An', phoneNumber: '0123456789', avatar: '' }}
      labels={labels}
      errorMessages={{}}
    />,
  );
  expect(screen.getByLabelText('Name')).toHaveValue('An');
  expect(screen.getByLabelText('Phone number')).toHaveValue('0123456789');
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
});
