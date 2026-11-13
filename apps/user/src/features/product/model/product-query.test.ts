import { describe, expect, it } from 'vitest';

import {
  productListQuerySchema,
  productQueryToParams,
  productSearchNameSchema,
} from '~/features/product/model/product-query';

describe('productListQuerySchema (searchParams — tha thứ)', () => {
  it('thiếu hết → mặc định an toàn', () => {
    expect(productListQuerySchema.parse({})).toEqual({
      page: 1,
      sortBy: 'createdAt',
      orderBy: 'desc',
    });
  });

  it('coerce page chuỗi → số', () => {
    expect(productListQuerySchema.parse({ page: '3' }).page).toBe(3);
  });

  it('page rác → catch về 1 (KHÔNG ném)', () => {
    expect(productListQuerySchema.parse({ page: 'abc' }).page).toBe(1);
    expect(productListQuerySchema.parse({ page: '-2' }).page).toBe(1);
  });

  it('enum sai → catch về mặc định', () => {
    const q = productListQuerySchema.parse({ sortBy: 'bogus', orderBy: 'x' });
    expect(q.sortBy).toBe('createdAt');
    expect(q.orderBy).toBe('desc');
  });

  it('name < 2 ký tự → bị loại (sanitize)', () => {
    expect(productListQuerySchema.parse({ name: 'a' }).name).toBeUndefined();
  });

  it('name hợp lệ → giữ (đã trim)', () => {
    expect(productListQuerySchema.parse({ name: '  Áo  ' }).name).toBe('Áo');
  });
});

describe('productSearchNameSchema (form — hiện lỗi)', () => {
  it('< 2 ký tự → lỗi code "too_short"', () => {
    const r = productSearchNameSchema.safeParse('a');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('too_short');
  });

  it('>= 2 ký tự → ok', () => {
    expect(productSearchNameSchema.safeParse('Áo').success).toBe(true);
  });
});

describe('productQueryToParams (→ URL gọn, bỏ mặc định)', () => {
  it('toàn mặc định → {} (URL sạch)', () => {
    expect(productQueryToParams(productListQuerySchema.parse({}))).toEqual({});
  });

  it('chỉ giữ giá trị KHÁC mặc định', () => {
    const q = productListQuerySchema.parse({ page: '2', name: 'Áo', sortBy: 'price' });
    expect(productQueryToParams(q)).toEqual({ page: '2', name: 'Áo', sortBy: 'price' });
  });
});
