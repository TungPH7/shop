import { z } from 'zod';

/**
 * Schema ở BIÊN: chỉ khai các field ta THỰC SỰ dùng → Zod tự loại mọi field nội bộ backend
 * (`createdById`/`updatedById`/`deletedById`/`variants`/`productTranslations`/timestamps…) =
 * bước "DTO tối thiểu" ngay tại boundary (data-security: chỉ giữ field UI cần).
 *
 * ⭐ Folder 20: THÊM `images` vì UI giờ hiển thị ảnh (next/image) → DTO TIẾN HOÁ theo nhu cầu UI
 * (giống mở rộng `profileSchema` ở folder 16), KHÔNG phải nhồi sẵn. `.default([])` → fixture/cũ thiếu
 * field vẫn parse (an toàn ngược). variants/createdById/… VẪN bị loại — nguyên tắc "tối thiểu" còn nguyên.
 *
 * Nguồn sự thật = backend NestJS thật `ProductSchema` (xem
 * `10_dtd/Nestjs-Super/ecom/src/shared/models/shared-product.model.ts`): `id:number`,
 * `basePrice/virtualPrice:number` (VND, KHÔNG phải cents), `images:string[]` … (khác hẳn schema giả định guide React).
 */
const backendProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  basePrice: z.number(),
  virtualPrice: z.number(),
  images: z.array(z.string()).default([]),
});

/** Envelope phân trang: `GET /products` → `{ data, totalItems, page, limit, totalPages }`. */
export const productListResponseSchema = z.object({
  data: z.array(backendProductSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

type BackendProduct = z.infer<typeof backendProductSchema>;

/** DTO domain (tối thiểu — đúng cái UI cần). Tiền VND (đồng), KHÔNG phải cents. */
export interface Product {
  id: number;
  name: string;
  priceVnd: number;
  originalPriceVnd: number;
  /** Folder 20 — danh sách URL ảnh (đã strip mọi field nội bộ khác). Có thể rỗng/placeholder. */
  images: string[];
}

/** Kết quả DAL danh sách (folder 13): DTO[] + meta phân trang lấy từ envelope backend. */
export interface ProductListResult {
  items: Product[];
  page: number;
  totalPages: number;
  totalItems: number;
}

/** Map fat backend object → DTO tối thiểu. Hàm THUẦN → test trực tiếp. */
export function mapToProduct(raw: BackendProduct): Product {
  return {
    id: raw.id,
    name: raw.name,
    priceVnd: raw.basePrice,
    originalPriceVnd: raw.virtualPrice,
    images: raw.images,
  };
}

// Host ảnh "giả" mà backend demo trả về (URL không load được). Khớp CHÍNH XÁC hostname (không phải hậu tố).
const PLACEHOLDER_IMAGE_HOSTS = new Set(['example.com', 'example.org', 'example.net']);

/**
 * Nguồn ảnh cho card sản phẩm (folder 20). Backend demo trả URL ẢNH GIẢ (`https://example.com/imgN.jpg`,
 * không load được) → nếu ảnh đầu KHÔNG phải absolute-URL hợp lệ HOẶC trỏ host placeholder, rơi về ảnh
 * placeholder TẤT ĐỊNH theo `id` (picsum) để có ảnh thật minh hoạ next/image. Backend trả ảnh CDN THẬT thì
 * đi thẳng (nhớ thêm host đó vào `images.remotePatterns` ở next.config). Hàm THUẦN → test được.
 */
export function productImageSrc(product: Pick<Product, 'id' | 'images'>): string {
  const first = product.images[0];
  if (first && URL.canParse(first) && !PLACEHOLDER_IMAGE_HOSTS.has(new URL(first).hostname)) {
    return first;
  }
  return `https://picsum.photos/seed/tungph7-${product.id}/600/400`;
}

/**
 * Format VND **deterministic** (tự nhóm hàng nghìn bằng regex, KHÔNG `Intl`/`toLocaleString` để
 * tránh phụ thuộc ICU giữa Node/browser → test khẳng định chuỗi chính xác): 800000 → "800.000 ₫".
 */
export function formatPriceVnd(amount: number): string {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped} ₫`;
}
