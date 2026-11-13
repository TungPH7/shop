import { dismiss } from '@/lib/notifications/notification-store';
import { useNotifications } from '@/lib/notifications/use-notifications';

// Headless renderer for the notification store. The container is an ARIA live
// region rendered ALWAYS (even when empty) so screen readers register it and
// announce the first toast. Errors use role="alert" (assertive); success/info
// use role="status" (polite). UI-agnostic (Phase 1.1): a real toast UI
// (portal, animation, positioning) arrives with the UI library in Phase 1.2 —
// the store/contract stays, only this markup changes.
export function Notifications() {
  const notifications = useNotifications();

  return (
    <div aria-live="polite">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          role={notification.kind === 'error' ? 'alert' : 'status'}
          data-kind={notification.kind}
        >
          <span>{notification.message}</span>{' '}
          <button
            type="button"
            onClick={() => {
              dismiss(notification.id);
            }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
