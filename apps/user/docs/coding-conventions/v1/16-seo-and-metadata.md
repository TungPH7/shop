# 16 — SEO & Metadata

> Ràng buộc xuyên suốt: **mọi route phải giữ `◐` (PPR)**. Metadata không được biến trang thành động.

## 16.1 `generateMetadata` — `[MUST]`

Site đa locale nên title/description phải dịch → dùng `generateMetadata`, không `metadata` tĩnh.

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale }); // ⭐ truyền locale TƯỜNG MINH
  return buildPageMetadata({ locale, pathname: '/products', title: t('Products.title') });
}
```

- **[MUST]** Không khai **cả** `metadata` tĩnh **lẫn** `generateMetadata` trong cùng segment.
- **[MUST]** Truyền `locale` tường minh vào `getTranslations` và chỉ đọc `params` (static param) → metadata vào **static shell** → route giữ `◐`.
- ❌ **Không** cho metadata phụ thuộc `searchParams` / `cookies()` / `headers()` / fetch không cache — sẽ đẩy metadata thành dynamic và làm hỏng prerender.

## 16.2 `metadataBase` & title — `[MUST]`

- Root layout khai `metadataBase: new URL(siteUrl)` → mọi field URL trong `Metadata` (canonical, hreflang, og) khai **tương đối**, Next tự ghép tuyệt đối.
- ⚠️ `metadataBase` **không** áp cho `sitemap.ts` / `robots.ts` / JSON-LD → những chỗ đó dùng `absoluteUrl()` từ `~/lib/seo/site-url.ts`.
- Title template ở root layout:
  ```ts
  title: { default: siteName, template: `%s · ${siteName}` }
  ```
  Trang con chỉ đặt title **ngắn, đã dịch**.
- `NEXT_PUBLIC_SITE_URL` = origin công khai của site (khác `NEXT_PUBLIC_API_URL` của backend).

## 16.3 Canonical & hreflang — `[MUST]` cho mọi trang public

Bắt buộc với site đa locale để chống trùng nội dung:

```ts
alternates: {
  canonical: localizedUrl(locale, pathname),
  languages: { en: …, vi: …, 'x-default': … },   // x-default trỏ defaultLocale
}
```

**[MUST]** Sinh đường dẫn bằng `getPathname` của next-intl (qua `~/lib/seo/alternates.ts`), ❌ không nối chuỗi tay.

## 16.4 `noindex` cho trang riêng tư — `[MUST]`

Trang riêng tư/tiện ích (`login`, `account`, `account/edit`, `forbidden`, `error-demo`, `caching`) → `robots: { index: false, follow: false }`; **không** vào sitemap, **không** khai hreflang.

Trang indexable hiện tại: `home`, `about`, `products`.

> ⭐ **`noindex` META ≠ `Disallow` trong robots.txt.** `Disallow` chỉ chặn crawl — bot không đọc được thẻ nên **không gỡ được** URL đã bị index. Trang riêng tư phải dùng **`noindex` META** (cho crawl, để bot đọc thẻ). ❌ Không disallow trang riêng tư.

## 16.5 Hạ tầng SEO — `[MUST]` dùng lại, đừng viết mới

`~/lib/seo/`:

| Module               | Cung cấp                                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| `site-url.ts`        | `siteUrl` (trim `/`) + `absoluteUrl()`                                       |
| `alternates.ts`      | `localizedPathnames` / `localizedAlternates` / `localizedUrl`                |
| `metadata.ts`        | **`buildPageMetadata`** — gom title/description/alternates, hoặc bật noindex |
| `structured-data.ts` | Builder JSON-LD typed bằng `schema-dts`                                      |

Trang mới → gọi `buildPageMetadata`, không tự lắp object `Metadata` từ đầu.

## 16.6 File metadata — `[MUST]`

| File                               | Ghi chú                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/sitemap.ts`                   | Chỉ trang indexable. ❌ **Không fetch backend** (giữ tĩnh + không phụ thuộc backend lúc build). Mỗi trang 1 `<url>` (loc = defaultLocale) + `alternates.languages`. URL **tuyệt đối**. Bỏ `lastModified` để giữ cached |
| `app/robots.ts`                    | Chỉ `Disallow: /api/` + `host` + `sitemap` tuyệt đối                                                                                                                                                                   |
| `app/[locale]/opengraph-image.tsx` | `next/og` `ImageResponse`, 1 PNG/locale. Next **tự gắn** `og:image` + `twitter:image` → ❌ không khai `openGraph.images` tay                                                                                           |
| `app/icon.svg`                     | Favicon file-based, SVG vector                                                                                                                                                                                         |

Lưu ý khi làm OG image (Satori): font mặc định **Geist đã phủ tiếng Việt** — không cần nạp font. `div` có >1 con phải `display: flex`. Logo nên là khối màu, tránh glyph lạ.

## 16.7 JSON-LD — `[MUST]`

- Dùng component `<JsonLd>` (`~/components/seo/json-ld.tsx`) + types `schema-dts` (devDep type-only, 0 runtime).
- ❌ Không tự viết `<script type="application/ld+json">` ở nơi khác — `<JsonLd>` là **ngoại lệ duy nhất** được phép dùng `dangerouslySetInnerHTML` (→ §14).
- Thực thể hiện có: `Organization` + `WebSite` (root layout, static) · `BreadcrumbList` (shell) · `ItemList` (stream từ data thật).

## 16.8 Checklist trang public mới — `[MUST]`

1. `generateMetadata` dùng `buildPageMetadata` với locale tường minh.
2. Có canonical + hreflang (hoặc `noindex` nếu là trang riêng tư).
3. Thêm vào `app/sitemap.ts` nếu indexable.
4. `pnpm build` → route vẫn `◐`.
5. `curl` kiểm tra thẻ `<link rel="canonical">`, `hrefLang`, và `/sitemap.xml`.
