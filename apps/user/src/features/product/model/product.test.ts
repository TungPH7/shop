import { expect, test } from 'vitest';

import {
  formatPriceVnd,
  mapToProduct,
  productImageSrc,
  productListResponseSchema,
} from './product';

// Payload "fat" giống backend NestJS thật (kèm field nội bộ) → chứng minh schema ở biên LOẠI chúng.
const backendPayload = {
  data: [
    {
      id: 29,
      name: 'Áo thể thao Ultra Thin',
      basePrice: 800000,
      virtualPrice: 1200000,
      images: ['string'],
      brandId: 23,
      variants: [{ value: 'Màu sắc', options: ['Đen', 'Trắng'] }],
      createdById: 1,
      deletedById: null,
      productTranslations: [],
    },
  ],
  totalItems: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
};

test('schema validate envelope thật + LOẠI field nội bộ (giữ images — folder 20 UI dùng)', () => {
  const parsed = productListResponseSchema.parse(backendPayload);
  // Giữ 5 field đã khai (gồm `images` từ folder 20); variants/createdById/deletedById/productTranslations bị loại.
  expect(parsed.data[0]).toEqual({
    id: 29,
    name: 'Áo thể thao Ultra Thin',
    basePrice: 800000,
    virtualPrice: 1200000,
    images: ['string'],
  });
  expect(parsed.totalItems).toBe(1);
});

test('mapToProduct → DTO domain {priceVnd, originalPriceVnd, images}', () => {
  const parsed = productListResponseSchema.parse(backendPayload);
  expect(mapToProduct(parsed.data[0]!)).toEqual({
    id: 29,
    name: 'Áo thể thao Ultra Thin',
    priceVnd: 800000,
    originalPriceVnd: 1200000,
    images: ['string'],
  });
});

test('formatPriceVnd nhóm hàng nghìn + ₫ (deterministic, no ICU)', () => {
  expect(formatPriceVnd(800000)).toBe('800.000 ₫');
  expect(formatPriceVnd(1200000)).toBe('1.200.000 ₫');
  expect(formatPriceVnd(0)).toBe('0 ₫');
  expect(formatPriceVnd(999)).toBe('999 ₫');
});

test('productImageSrc: ảnh placeholder/thiếu → picsum tất định theo id; URL CDN thật → đi thẳng', () => {
  // backend trả host placeholder (example.com) → fallback picsum theo id
  expect(productImageSrc({ id: 7, images: ['https://example.com/img2.jpg'] })).toBe(
    'https://picsum.photos/seed/tungph7-7/600/400',
  );
  // không có ảnh → cũng fallback theo id
  expect(productImageSrc({ id: 9, images: [] })).toBe(
    'https://picsum.photos/seed/tungph7-9/600/400',
  );
  // URL CDN THẬT → giữ nguyên (đi qua optimizer)
  expect(productImageSrc({ id: 1, images: ['https://cdn.myshop.io/p/1.webp'] })).toBe(
    'https://cdn.myshop.io/p/1.webp',
  );
});
