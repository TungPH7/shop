'use client';

import Image from 'next/image';

// ⭐ Folder 20 — component được LAZY-LOAD bằng next/dynamic (xem product-image-zoom-button). "Nặng" theo
// nghĩa minh hoạ: chỉ cần khi user bấm "Phóng to" → KHÔNG nên nằm trong bundle đầu của /products. `default
// export` để `dynamic(() => import('./product-image-zoom'))` lấy trực tiếp (named export thì phải `.then`).
export default function ProductImageZoom({
  src,
  alt,
  closeLabel,
  onClose,
}: {
  src: string;
  alt: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="zoom-overlay" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="zoom-content">
        {/* Ảnh lớn cũng qua next/image (tối ưu + same-origin /_next/image). */}
        <Image
          src={src}
          alt={alt}
          width={600}
          height={400}
          sizes="(max-width: 768px) 90vw, 600px"
          className="zoom-img"
        />
        <button type="button" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
