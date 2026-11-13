'use client';

import { useState } from 'react';

import { useRouter } from '~/i18n/navigation';

interface RevalidateButtonProps {
  label: string;
  hint: string;
}

/**
 * Nút (client) kích hoạt on-demand revalidation cho demo:
 *  POST `/api/revalidate` → `revalidateTag('caching-demo')` (server) → `router.refresh()` tải
 *  lại RSC → mốc thời gian CACHE đổi (mốc LIVE vốn đã đổi mỗi request).
 *
 * `onClick={() => void handle()}`: ép trả `void` cho handler async (thoả `no-misused-promises`).
 * ⚠️ Mutation THẬT + revalidate nên đi qua **Server Action** (folder 12); Route Handler ở đây
 *    chỉ minh hoạ `revalidateTag` chạy on-demand. Route revalidate khi PROD phải có auth (folder 15).
 */
export function RevalidateButton({ label, hint }: RevalidateButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleRevalidate() {
    setPending(true);
    try {
      await fetch('/api/revalidate', { method: 'POST' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <p>
      <button type="button" onClick={() => void handleRevalidate()} disabled={pending}>
        {label}
      </button>{' '}
      <span>{hint}</span>
    </p>
  );
}
