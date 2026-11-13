import {
  type BreadcrumbList,
  type ItemList,
  type Organization,
  type WebSite,
  type WithContext,
} from 'schema-dts';

import { absoluteUrl, siteUrl } from '~/lib/seo/site-url';
import { siteConfig } from '~/lib/site-config';

// schema-dts (types CHÍNH THỐNG của Google cho schema.org) cho autocomplete + bắt sai @type/field
// ngay lúc typecheck. `WithContext<T>` = T + `@context`. Builder THUẦN (0 IO) → test được, dùng được
// cả ở static shell (Org/WebSite) lẫn dynamic-hole (ItemList).

const CONTEXT = 'https://schema.org';

/**
 * `Organization` — thực thể TỔ CHỨC, dùng SITE-WIDE (root layout). Language-neutral (Google đọc
 * `<html lang>` cho ngôn ngữ) → constant, KHÔNG cần locale. Logo nên là ảnh ≥112px ở prod.
 */
export function organizationLd(): WithContext<Organization> {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteUrl,
    logo: absoluteUrl('/icon.svg'),
  };
}

/** `WebSite` — thực thể TRANG WEB, site-wide. Constant (name + url). */
export function webSiteLd(): WithContext<WebSite> {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteUrl,
  };
}

/** 1 phần tử list: `name` bắt buộc; `url` tuỳ chọn (vd sản phẩm CHƯA có trang chi tiết → bỏ url). */
export type ListLdItem = { name: string; url?: string };
/** 1 nấc breadcrumb: `name` + `url` TUYỆT ĐỐI (bắt buộc). */
export type BreadcrumbLdItem = { name: string; url: string };

/**
 * `ItemList` — danh sách có thứ tự (vd danh sách sản phẩm). `name` lấy từ DATA THẬT đã fetch
 * (folder 11) → đặt ở dynamic-hole `ProductResults` (stream; bot chạy JS đọc được). `listName` đã dịch.
 * `url` bỏ qua khi chưa có trang chi tiết sản phẩm (route `[id]` hoãn — §22). `exactOptionalPropertyTypes`
 * → spread có điều kiện (folder 02).
 */
export function itemListLd(items: ListLdItem[], listName: string): WithContext<ItemList> {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    name: listName,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url ? { url: item.url } : {}),
    })),
  };
}

/**
 * `BreadcrumbList` — đường dẫn phân cấp (Trang chủ › Sản phẩm). `item` = URL TUYỆT ĐỐI của từng nấc;
 * `name` đã dịch. Đặt ở static shell của page (không phụ thuộc data) → vào HTML prerender.
 */
export function breadcrumbLd(crumbs: BreadcrumbLdItem[]): WithContext<BreadcrumbList> {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}
