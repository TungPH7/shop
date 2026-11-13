# 07 — Rendering & Caching (Cache Components · PPR)

> `cacheComponents: true` đổi **mặc định toàn app**. Chương này là nơi hay gây lỗi build nhất — đọc kỹ trước khi thêm route mới.

## 7.1 Mô hình mặc định — `[MUST]` hiểu

Với `cacheComponents: true`:

- **Dynamic-by-default** — không có gì được cache trừ khi bạn opt-in bằng `'use cache'`.
- **PPR mặc định** — Next prerender phần **static shell**, để phần động thành "hole" và stream vào sau.
- Build in ra ký hiệu route: **`◐`** = partial prerender (mục tiêu), `○` = tĩnh hoàn toàn, `ƒ` = động hoàn toàn.

> **[MUST]** Route mới phải đạt `◐` (hoặc `○`). Nếu ra `ƒ`, tức là có gì đó đọc request-time ngoài `<Suspense>` → phải sửa, không merge.

## 7.2 `'use cache'` — `[MUST]`

Đặt ở đầu file, component hoặc **hàm**; giá trị trả về được cache.

```ts
// ✅ cache key = buildId + id hàm + ARGS (biến closure cũng tự vào key)
export async function getProducts(query: ProductQuery) {
  'use cache';
  cacheLife('hours');
  cacheTag('products');
  return httpGet('/products', productListSchema, query);
}
```

**⚠️ Luật cô lập — `[MUST]`:** trong scope `'use cache'` **không được** đọc request-time:

| ❌ Cấm trong scope cache    | ✅ Cách làm đúng                                  |
| --------------------------- | ------------------------------------------------- |
| `cookies()` / `headers()`   | Đọc **ngoài**, truyền vào qua tham số             |
| `params` / `searchParams`   | Đọc ở page, truyền **args** xuống                 |
| `new Date()` / giờ hiện tại | Truyền timestamp vào như args                     |
| `Math.random()`             | Sinh ngoài, truyền vào                            |
| `getTranslations()`         | Giải i18n ở orchestrator, truyền **string** xuống |

Vi phạm → build treo hoặc lỗi khó hiểu.

- File-level `'use cache'` → **mọi export trong file phải `async`**.

## 7.3 `cacheLife` — `[MUST]`

```ts
cacheLife('hours'); // profile có sẵn: seconds | minutes | hours | days | weeks | max
```

Mỗi profile có 3 mốc: `stale` (client) / `revalidate` (SWR ở server) / `expire` (regen đồng bộ).

> Profile **ngắn** (`revalidate: 0` hoặc `expire < 5m`, gồm cả `seconds`) biến vùng đó thành **dynamic hole** → **[MUST]** bọc `<Suspense>`.

## 7.4 `cacheTag` & invalidation — `[MUST]`

```ts
cacheTag('products'); // gắn nhãn trong scope cache
```

| API                                  | Tham số                            | Dùng ở đâu                   | Ngữ nghĩa                                         |
| ------------------------------------ | ---------------------------------- | ---------------------------- | ------------------------------------------------- |
| `revalidateTag('products', 'hours')` | **2 tham số** (bắt buộc ở Next 16) | Route Handler, Server Action | SWR — đánh dấu stale rồi làm mới ở nền            |
| `updateTag('products')`              | **1 tham số**                      | **Chỉ** Server Action        | Read-your-writes — user thấy ngay kết quả vừa ghi |

**[MUST]** Sau mutation trong Server Action → dùng `updateTag`. Dùng nhầm `revalidateTag` = user bấm xoá xong vẫn thấy item cũ.

## 7.5 Dynamic hole & `<Suspense>` — `[MUST]`

Mọi thứ đọc request-time **phải** nằm trong `<Suspense>`, nếu không build báo lỗi blocking-route:

- `cookies()` / `headers()` / `connection()`
- `searchParams`
- Component đọc session: guard, `getProfile`, `<Can>`, `AuthStatus`
- **Server Action gắn vào `<form action>`** (⚠️ chỉ `next dev` bắt lỗi này; `build` bỏ qua → **bắt buộc verify bằng `pnpm dev`**, không chỉ build)
- Provider client-state đọc random/request-time (Redux, nuqs, TanStack)

```tsx
// ✅ shell tĩnh + hole động
export default function Page() {
  return (
    <>
      <ProductsHeader /> {/* static shell */}
      <Suspense fallback={<ResultsSkeleton />}>
        <ProductResults /> {/* đọc searchParams → dynamic */}
      </Suspense>
    </>
  );
}
```

## 7.6 Mẫu kiến trúc chuẩn — `[SHOULD]`

```
app/…/page.tsx        mỏng: setRequestLocale → render feature shell
  └─ <FeatureShell>   static: tiêu đề, breadcrumb, khung
       └─ <Suspense>
            └─ <FeatureResults>   orchestrator async:
                 • giải i18n MỘT LẦN (getTranslations)
                 • await DAL (hàm 'use cache')
                 • truyền data + string xuống VIEW ĐỒNG BỘ (test được)
```

Thứ tự đọc trong orchestrator: **request-time / uncached data TRƯỚC → giờ hiện tại SAU**.

## 7.7 i18n × cache — `[MUST]`

- Gọi `setRequestLocale(locale)` ở **mọi** layout và page → giữ khả năng prerender.
- ❌ **Không** gọi `getTranslations` bên trong scope `'use cache'`. Giải ở orchestrator (prerender được) rồi truyền chuỗi xuống hàm cache / dynamic hole.

## 7.8 Bẫy hay gặp — `[MUST]` tránh

| Triệu chứng                                  | Nguyên nhân                                | Cách sửa                                                    |
| -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Build lỗi `Uncached data outside <Suspense>` | Đọc request-time ở shell tĩnh              | Bọc `<Suspense>` hoặc đẩy xuống hole                        |
| Route thành `ƒ` thay vì `◐`                  | Root layout hoặc metadata đọc request-time | Xem lại `await params` ở layout, `generateMetadata` (→ §16) |
| Build treo ~50s rồi fail                     | Vi phạm luật cô lập §7.2                   | Chuyển thứ đang đọc ra ngoài scope cache                    |
| `Math.random() in Client Component`          | Provider client-state ở static root        | Scope provider vào trong `<Suspense>` (→ §10)               |
| Xoá xong vẫn thấy item cũ                    | Dùng `revalidateTag` thay `updateTag`      | Đổi sang `updateTag` trong Server Action                    |
| Trạng thái lỗi bị cache lại                  | `try/catch` đặt **trong** scope cache      | Đưa `try/catch` ra **ngoài** `'use cache'` (→ §13)          |
