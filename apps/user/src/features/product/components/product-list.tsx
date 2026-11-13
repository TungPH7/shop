import Image from 'next/image';
import { type ReactNode } from 'react';

import { formatPriceVnd, productImageSrc, type Product } from '~/features/product/model/product';

interface ProductListProps {
  products: Product[];
  emptyLabel: string;
  /**
   * Slot TUỲ CHỌN: render island tương tác (vd nút Xoá) cho từng dòng. Dùng render-prop để
   * ProductList giữ THUẦN (không tự import Server Action/'use client') → vẫn unit-test được như cũ;
   * tầng app (composition root) mới bơm island vào. Bỏ trống → danh sách chỉ-đọc (test folder 11 vẫn xanh).
   */
  renderItemActions?: (product: Product) => ReactNode;
}

/**
 * View THUẦN sync (no hook, no I/O) → unit-test được (mẫu giống `SnapshotView` folder 10). Nhận
 * DTO[] đã map từ DAL. Hiển thị tên + giá; gạch giá gốc khi `originalPriceVnd > priceVnd` (đang sale).
 */
export function ProductList({ products, emptyLabel, renderItemActions }: ProductListProps) {
  if (products.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          {/* ⭐ Folder 20 — next/image (fill): ô .product-thumb có aspect-ratio cố định → giữ chỗ = 0 CLS.
              Ảnh REMOTE (picsum/CDN) được optimizer proxy qua /_next/image (same-origin) → CSP giữ 'self'.
              `sizes` báo trình duyệt chọn đúng độ phân giải srcset (tiết kiệm băng thông). Card KHÔNG
              priority → lazy mặc định (chỉ tải khi gần viewport). */}
          <span className="product-thumb">
            <Image
              src={productImageSrc(product)}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 240px"
            />
          </span>
          <span>{product.name}</span> — <strong>{formatPriceVnd(product.priceVnd)}</strong>
          {product.originalPriceVnd > product.priceVnd && (
            <>
              {' '}
              <del>{formatPriceVnd(product.originalPriceVnd)}</del>
            </>
          )}
          {renderItemActions ? <> {renderItemActions(product)}</> : null}
        </li>
      ))}
    </ul>
  );
}
