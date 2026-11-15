import { useState } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { Dialog } from '@/components/ui/dialog';
import { act, fireEvent, renderWithProviders, screen } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

interface HarnessProps {
  onCancel?: () => void;
  isBusy?: boolean;
  error?: string;
}

// A row button that opens the dialog, as S1.8 opens S3.
function DeleteHarness({ onCancel, isBusy, error }: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Delete Quần jean nam
      </button>
      <Dialog
        open={open}
        title="Delete “Quần jean nam”?"
        cancelLabel="Cancel"
        onCancel={() => {
          onCancel?.();
          if (isBusy !== true) setOpen(false);
        }}
        action={
          <button type="button" className="btn btn--danger">
            Delete
          </button>
        }
        isBusy={isBusy}
        error={error}
      >
        <p>This can&apos;t be undone.</p>
        <p>To stop selling it for now, set its status to Hidden instead.</p>
      </Dialog>
    </>
  );
}

function getDialog(): HTMLDialogElement {
  const dialog = screen.getByRole('alertdialog');
  if (!(dialog instanceof HTMLDialogElement)) throw new Error('not a <dialog>');
  return dialog;
}

async function openDialog(props: HarnessProps = {}) {
  const rendered = renderWithProviders(<DeleteHarness {...props} />);
  await rendered.user.click(screen.getByRole('button', { name: 'Delete Quần jean nam' }));
  return rendered;
}

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    renderWithProviders(<DeleteHarness />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens as a modal alert dialog named by its title and described by its body', async () => {
    await openDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Quần jean nam”?' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      "This can't be undone. To stop selling it for now, set its status to Hidden instead.",
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Delete “Quần jean nam”?' })).toBe(
      screen.getByText('Delete “Quần jean nam”?'),
    );
  });

  it('puts the first focus on Cancel, the safe button', async () => {
    await openDialog();

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('cancels with the Cancel button and gives focus back to the opener', async () => {
    const onCancel = vi.fn();
    const { user } = await openDialog({ onCancel });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Quần jean nam' })).toHaveFocus();
  });

  it('cancels with the round Close button', async () => {
    const onCancel = vi.fn();
    const { user } = await openDialog({ onCancel });

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('names the Close button in the language of the page', async () => {
    await act(() => testI18n.changeLanguage('vi'));
    const { user } = renderWithProviders(<DeleteHarness />);
    await user.click(screen.getByRole('button', { name: 'Delete Quần jean nam' }));

    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
  });

  it('treats Esc, the cancel event of <dialog>, as Cancel and keeps the dialog in React’s hands', async () => {
    const onCancel = vi.fn();
    await openDialog({ onCancel });
    const dialog = screen.getByRole('alertdialog');

    const event = new Event('cancel', { cancelable: true });
    fireEvent(dialog, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('runs the action of the caller', async () => {
    const { user } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('locks Cancel, Close and Esc while busy', async () => {
    const onCancel = vi.fn();
    const { user } = await openDialog({ onCancel, isBusy: true });

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const close = screen.getByRole('button', { name: 'Close' });
    expect(cancel).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('aria-disabled', 'true');

    await user.click(cancel);
    await user.click(close);
    fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('shows an error above the buttons as an alert', async () => {
    await openDialog({ error: "Couldn't delete. Please try again." });

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't delete. Please try again.");
  });

  it('treats a close by the browser as Cancel', async () => {
    const onCancel = vi.fn();
    await openDialog({ onCancel });

    getDialog().close();

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('opens again when the browser closes it while busy', async () => {
    await openDialog({ isBusy: true });
    const dialog = getDialog();

    dialog.close();

    expect(dialog).toHaveAttribute('open');
  });
});
