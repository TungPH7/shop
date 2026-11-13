'use client';

import { useDensity } from '~/stores/use-density';

interface DensityToggleProps {
  labels: { label: string; comfortable: string; compact: string };
}

/**
 * Nút đổi mật độ — đọc/ghi qua FACADE `useDensity` (KHÔNG import react-redux trực tiếp; ESLint cấm).
 * Nhãn i18n bơm từ server (server-first: giải i18n ở server → truyền chuỗi xuống, client KHÔNG cần provider).
 */
export function DensityToggle({ labels }: DensityToggleProps) {
  const { density, toggle } = useDensity();
  const current = density === 'compact' ? labels.compact : labels.comfortable;
  return (
    <button type="button" onClick={toggle} aria-pressed={density === 'compact'}>
      {labels.label}: {current}
    </button>
  );
}
