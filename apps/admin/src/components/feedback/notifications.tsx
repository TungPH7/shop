import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import {
  dismiss,
  type NotificationKind,
  pauseTimers,
  resumeTimers,
} from '@/lib/notifications/notification-store';
import { useNotifications } from '@/lib/notifications/use-notifications';

// Toasts of admin (Design System: "Toast"; S1.12), the renderer of the notification
// store. They stack at the bottom centre of the screen and each closes after 6 s; the
// store holds the countdown, and it stops while the pointer is over the toasts or
// focus is in them, so a toast never goes while it is being read.
// The live region is always rendered, even empty, so screen readers register it and
// announce the first toast. Errors are alerts (assertive); success and info are
// statuses (polite).
// useSuspense is off: this sits outside every Suspense boundary (app/provider.tsx), so
// it must not suspend while i18n loads.

function ToastIcon({ kind }: { kind: NotificationKind }) {
  return (
    <svg className="toast__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {kind === 'success' ? (
        <path
          d="m6.5 10.25 2.25 2.25 4.75-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {kind === 'error' ? (
        <path
          d="M10 5.75v5M10 13.75v.25"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      ) : null}
      {kind === 'info' ? (
        <path d="M10 9v5M10 6v.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// Where focus goes when a toast is dismissed with the keyboard, rather than to <body>
// with the removed button (WCAG 2.4.3): the close button of the next toast, or of the
// one before, or back where focus was before it entered the toasts.
function focusAfterDismiss(button: HTMLElement, origin: HTMLElement | null) {
  const toast = button.closest('.toast');
  const neighbour = (
    toast?.nextElementSibling ?? toast?.previousElementSibling
  )?.querySelector<HTMLElement>('.toast__close');
  return neighbour ?? (origin?.isConnected ? origin : null);
}

export function Notifications() {
  const { t } = useTranslation('common', { useSuspense: false });
  const notifications = useNotifications();
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const isPaused = isHovered || hasFocus;
  // Where focus was before it entered the toasts, to give it back.
  const focusOriginRef = useRef<HTMLElement | null>(null);

  // Sync the countdowns of the store with the pointer and focus.
  useEffect(() => {
    if (!isPaused) return undefined;
    pauseTimers();
    return resumeTimers;
  }, [isPaused]);

  return (
    <section
      className="toasts"
      aria-label={t('notifications.label')}
      aria-live="polite"
      // mouseover, not mouseenter: it fires again on the next move over a toast after
      // a dismissal has cleared isHovered below.
      onMouseOver={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focusOriginRef.current =
            event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
        }
        setHasFocus(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="toast"
          role={notification.kind === 'error' ? 'alert' : 'status'}
          data-kind={notification.kind}
        >
          <ToastIcon kind={notification.kind} />
          <p className="toast__message">{notification.message}</p>
          <button
            type="button"
            className="toast__close"
            aria-label={t('notifications.dismiss')}
            onClick={(event) => {
              // Read before dismiss() removes this button from the toasts.
              const toasts = event.currentTarget.closest('.toasts');
              // A click from Enter or Space has no pointer position (detail 0).
              const target =
                event.detail === 0
                  ? focusAfterDismiss(event.currentTarget, focusOriginRef.current)
                  : null;
              target?.focus();
              dismiss(notification.id);
              // The focused button is gone and browsers send no blur for that, so
              // count again unless focus moved to another toast. The stack sits at
              // the bottom, so the toasts left drop down and the pointer may be
              // outside them with no mouseleave: count again until the next mouseover.
              if (!toasts?.contains(target)) setHasFocus(false);
              setIsHovered(false);
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </section>
  );
}
