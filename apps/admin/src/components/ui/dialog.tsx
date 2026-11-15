import { type ReactNode, useEffect, useId, useRef } from 'react';

import { useTranslation } from 'react-i18next';

// Confirmation dialog of admin (Design System: "Hộp thoại"; S3). A native <dialog>
// opened with showModal(), so the page behind is inert and Tab stays in the dialog.
// - role=alertdialog, aria-modal, named by its title and described by its body;
// - the first focus is on Cancel, the safe button;
// - Esc (the cancel event of <dialog>) acts as Cancel, and so does a close by the
//   browser; the caller owns `open` and closes it in onCancel;
// - on close, focus goes back to the element that had it when the dialog opened
//   (S1.8). If that element is gone, as the row of a deleted product, the caller
//   moves focus.
// While isBusy, Cancel, Close and Esc do nothing; they stay focusable (aria-disabled),
// so focus never falls out of the dialog. The caller locks its own action the same way.

interface DialogProps {
  open: boolean;
  title: string;
  /** The body, which describes the dialog: what happens, what to do instead. */
  children: ReactNode;
  cancelLabel: string;
  onCancel: () => void;
  /** The button that does the thing, e.g. the Delete button of S3. */
  action: ReactNode;
  isBusy?: boolean | undefined;
  /** Shown above the buttons as an alert, e.g. "Couldn't delete. Please try again." */
  error?: string | undefined;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function OpenDialog({
  title,
  children,
  cancelLabel,
  onCancel,
  action,
  isBusy = false,
  error,
}: Omit<DialogProps, 'open'>) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  // Sync with the browser's modal API: open on mount; on unmount close it and give
  // focus back to the opener.
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      if (opener?.isConnected === true) opener.focus();
    };
  }, []);

  function cancel() {
    if (!isBusy) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClose={() => {
        // Only the browser closes it while it is mounted (OpenDialog unmounts first
        // when the caller closes it).
        if (isBusy) dialogRef.current?.showModal();
        else onCancel();
      }}
    >
      <div className="dialog__header">
        <h2 className="dialog__title" id={titleId}>
          {title}
        </h2>
        <button
          type="button"
          className="dialog__close"
          aria-label={t('dialog.close')}
          aria-disabled={isBusy || undefined}
          onClick={cancel}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="dialog__body" id={bodyId}>
        {children}
      </div>
      {error !== undefined ? (
        <p className="banner banner--error dialog__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog__actions">
        <button
          ref={cancelRef}
          type="button"
          className="btn btn--secondary"
          aria-disabled={isBusy || undefined}
          onClick={cancel}
        >
          {cancelLabel}
        </button>
        {action}
      </div>
    </dialog>
  );
}

export function Dialog({ open, ...props }: DialogProps) {
  return open ? <OpenDialog {...props} /> : null;
}
