'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

// ⭐⭐ Folder 20 — next/dynamic: LAZY-LOAD component nặng/ít dùng để cắt JS khỏi bundle ban đầu.
// `ssr: false` (chỉ render phía client) CHỈ hợp lệ TRONG Client Component — đặt trong Server Component sẽ
// lỗi "ssr: false is not allowed with next/dynamic in Server Components. Please move it into a Client
// Component" (docs Next). Vì vậy lời gọi `dynamic()` nằm ở file `'use client'` này (KHÔNG ở page/RSC).
// `loading` = fallback trong lúc tải chunk. Modal chỉ tải khi `open` → là MỘT chunk RIÊNG, không nằm trong
// JS đầu của /products (mở DevTools › Network: thấy file .js mới được tải đúng lúc bấm).
const ProductImageZoom = dynamic(() => import('./product-image-zoom'), {
  ssr: false,
  loading: () => (
    <span role="status" aria-label="loading">
      …
    </span>
  ),
});

export function ProductImageZoomButton({
  src,
  alt,
  label,
  closeLabel,
}: {
  src: string;
  alt: string;
  label: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <ProductImageZoom
          src={src}
          alt={alt}
          closeLabel={closeLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
