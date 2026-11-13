'use client';

import { useQueryState } from 'nuqs';

import { VIEW_MODES, VIEW_QUERY_KEY, viewParser } from '~/features/product/model/product-view';

interface ViewToggleProps {
  labels: { label: string; list: string; grid: string };
}

/**
 * Đổi chế độ xem qua **nuqs** `useQueryState` → ghi thẳng vào URL (`?view=grid`): client-nav (không
 * reload), shareable, back/forward hoạt động. Tương phản với `DensityToggle` (Redux → localStorage).
 */
export function ViewToggle({ labels }: ViewToggleProps) {
  const [view, setView] = useQueryState(VIEW_QUERY_KEY, viewParser);
  return (
    <div role="group" aria-label={labels.label}>
      {VIEW_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={view === mode}
          onClick={() => void setView(mode)}
        >
          {mode === 'grid' ? labels.grid : labels.list}
        </button>
      ))}
    </div>
  );
}
