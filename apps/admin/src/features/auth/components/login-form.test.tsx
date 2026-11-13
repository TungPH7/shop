import { afterEach, describe, expect, it } from 'vitest';

import { LoginForm } from '@/features/auth/components/login-form';
import { clearTokens, getAccessToken } from '@/lib/auth/token-storage';
import { renderWithProviders, screen, waitFor } from '@/testing/render';

describe('LoginForm', () => {
  afterEach(() => {
    clearTokens();
  });

  it('shows a validation error and does NOT submit on a bad email', async () => {
    const { user } = renderWithProviders(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument(); // zod field error
    expect(getAccessToken()).toBeNull(); // mutation never fired
  });

  it('submits valid credentials and stores the tokens (MSW)', async () => {
    const { user } = renderWithProviders(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(getAccessToken()).toBe('test-access');
    });
  });
});
