import { afterEach, describe, expect, it, vi } from 'vitest';

import { Notifications } from '@/components/feedback/notifications';
import { clearAll, notify } from '@/lib/notifications/notification-store';
import { act, fireEvent, renderWithProviders, screen } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

describe('Notifications', () => {
  afterEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  it('keeps an empty live region in a labelled region, so the first toast is announced', () => {
    renderWithProviders(<Notifications />);

    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
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

  it('renders a success notification as a status', () => {
    renderWithProviders(<Notifications />);

    act(() => {
      notify.success('Product deleted');
    });

    expect(screen.getByRole('status')).toHaveTextContent('Product deleted');
  });

  it('names the dismiss button in the language of the page', async () => {
    await act(() => testI18n.changeLanguage('vi'));
    renderWithProviders(<Notifications />);

    act(() => {
      notify.success('Đã xóa sản phẩm');
    });

    expect(screen.getByRole('button', { name: 'Đóng thông báo' })).toBeInTheDocument();
  });

  it('closes a toast by itself after 6 seconds', () => {
    vi.useFakeTimers();
    renderWithProviders(<Notifications />);
    act(() => {
      notify.success('Product added');
    });

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText('Product added')).not.toBeInTheDocument();
  });

  it('stays while the pointer is over it, then finishes its 6 seconds', () => {
    vi.useFakeTimers();
    renderWithProviders(<Notifications />);
    act(() => {
      notify.success('Product saved');
    });
    const toast = screen.getByRole('status');

    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('Product saved')).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText('Product saved')).not.toBeInTheDocument();
  });

  it('stays while it has focus, then finishes its 6 seconds', () => {
    vi.useFakeTimers();
    renderWithProviders(
      <>
        <button type="button">Elsewhere</button>
        <Notifications />
      </>,
    );
    act(() => {
      notify.success('Product saved');
    });

    act(() => {
      screen.getByRole('button', { name: 'Dismiss notification' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('Product saved')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText('Product saved')).not.toBeInTheDocument();
  });

  it('starts counting again once the focused toast is dismissed with the mouse', () => {
    vi.useFakeTimers();
    renderWithProviders(<Notifications />);
    act(() => {
      notify.success('First');
      notify.success('Second');
    });
    const [first] = screen.getAllByRole('button', { name: 'Dismiss notification' });
    if (first === undefined) throw new Error('no dismiss button');

    act(() => {
      first.focus();
    });
    fireEvent.click(first, { detail: 1 });
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  // The stack sits at the bottom, so closing the top toast with the mouse drops the
  // others under the pointer, and the browser may send no mouseleave for that.
  it('counts again after a toast is closed with the mouse, even with others left', () => {
    vi.useFakeTimers();
    renderWithProviders(<Notifications />);
    act(() => {
      notify.success('First');
      notify.success('Second');
    });
    const [first] = screen.getAllByRole('button', { name: 'Dismiss notification' });
    if (first === undefined) throw new Error('no dismiss button');

    fireEvent.mouseEnter(first);
    fireEvent.click(first, { detail: 1 });
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  it('stops again when the pointer moves over a toast that is left', () => {
    vi.useFakeTimers();
    renderWithProviders(<Notifications />);
    act(() => {
      notify.success('First');
      notify.success('Second');
    });
    const [first] = screen.getAllByRole('button', { name: 'Dismiss notification' });
    if (first === undefined) throw new Error('no dismiss button');

    fireEvent.mouseEnter(first);
    fireEvent.click(first, { detail: 1 });
    fireEvent.mouseOver(screen.getByText('Second'));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('moves focus to the next toast when one is dismissed with the keyboard', async () => {
    const { user } = renderWithProviders(<Notifications />);
    act(() => {
      notify.success('First');
      notify.success('Second');
      notify.success('Third');
    });
    const [, second, third] = screen.getAllByRole('button', { name: 'Dismiss notification' });

    act(() => {
      second?.focus();
    });
    await user.keyboard('{Enter}');

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(third).toHaveFocus();
  });

  it('moves focus to the toast before when the last one is dismissed with the keyboard', async () => {
    const { user } = renderWithProviders(<Notifications />);
    act(() => {
      notify.success('First');
      notify.success('Second');
    });
    const [first, second] = screen.getAllByRole('button', { name: 'Dismiss notification' });

    act(() => {
      second?.focus();
    });
    await user.keyboard(' ');

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(first).toHaveFocus();
  });

  it('gives focus back to where it came from when the only toast is dismissed with the keyboard', async () => {
    const { user } = renderWithProviders(
      <>
        <button type="button">Save</button>
        <Notifications />
      </>,
    );
    act(() => {
      notify.success('Product saved');
    });

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.queryByText('Product saved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });
});
