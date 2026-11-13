'use client';

import { type FormEvent, useState } from 'react';

import {
  productSearchNameSchema,
  type ProductListQuery,
} from '~/features/product/model/product-query';

interface ProductFiltersProps {
  current: ProductListQuery;
  labels: {
    search: string;
    searchPlaceholder: string;
    sort: string;
    order: string;
    apply: string;
    sortOptions: Record<'createdAt' | 'price' | 'sale', string>;
    orderOptions: Record<'asc' | 'desc', string>;
  };
  /** code lỗi (vd `too_short`) → chuỗi đã dịch (server map sẵn — giống `messages` của DeleteProductButton). */
  errorMessages: Record<string, string>;
}

/**
 * Island lọc/sắp xếp (folder 13). `<form method="get">` → **progressive enhancement**: KHÔNG JS vẫn
 * navigate (browser tự build query từ input `name`/`sortBy`/`orderBy`) → server validate + sanitize
 * (defense-in-depth). CÓ JS: `onSubmit` validate `name` bằng **CHÍNH `productSearchNameSchema` mà
 * server dùng** (bằng chứng "share client/server") → < 2 ký tự thì CHẶN navigate + hiện lỗi (code →
 * i18n). Bỏ `page` khỏi form → đổi filter tự reset về trang 1.
 */
export function ProductFilters({ current, labels, errorMessages }: ProductFiltersProps) {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const raw = new FormData(event.currentTarget).get('name');
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (name.length > 0) {
      const parsed = productSearchNameSchema.safeParse(name);
      if (!parsed.success) {
        event.preventDefault(); // chặn navigate khi không hợp lệ
        const code = parsed.error.issues[0]?.message ?? 'invalid';
        setError(errorMessages[code] ?? code);
        return;
      }
    }
    setError(null); // hợp lệ / rỗng → để form GET tự navigate (progressive enhancement)
  }

  return (
    <form method="get" onSubmit={handleSubmit}>
      <label>
        {labels.search}{' '}
        <input
          type="search"
          name="name"
          defaultValue={current.name ?? ''}
          placeholder={labels.searchPlaceholder}
        />
      </label>{' '}
      <label>
        {labels.sort}{' '}
        <select name="sortBy" defaultValue={current.sortBy}>
          <option value="createdAt">{labels.sortOptions.createdAt}</option>
          <option value="price">{labels.sortOptions.price}</option>
          <option value="sale">{labels.sortOptions.sale}</option>
        </select>
      </label>{' '}
      <label>
        {labels.order}{' '}
        <select name="orderBy" defaultValue={current.orderBy}>
          <option value="asc">{labels.orderOptions.asc}</option>
          <option value="desc">{labels.orderOptions.desc}</option>
        </select>
      </label>{' '}
      <button type="submit">{labels.apply}</button>
      {error !== null && <span role="alert"> {error}</span>}
    </form>
  );
}
