import { afterEach, describe, expect, it } from 'vitest';

import { Notifications } from '@/components/feedback/notifications';
import { clearAll, notify } from '@/lib/notifications/notification-store';
import { act, renderWithProviders, screen } from '@/testing/render';

describe('Notifications', () => {
  afterEach(() => {
    clearAll();
  });

  it('renders an error notification as an alert and dismisses it', async () => {
    const { user } = renderWithProviders(<Notifications />);

    // notify() mutates the store outside a React event → wrap in act().
    act(() => {
      notify.error('something failed');
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('something failed');

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('something failed')).not.toBeInTheDocument();
  });
});
