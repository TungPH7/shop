# 10 — State Management

> Server-first ⇒ client state phải **tối thiểu**. Câu hỏi đầu tiên luôn là: "state này có cần ở client không?"

## 10.1 Thang ưu tiên — `[MUST]`

Chọn từ trên xuống, chỉ đi tiếp khi phương án trên **không** đáp ứng được:

| #   | Nhà chứa state         | Dùng khi                                              | Công cụ                                                                         |
| --- | ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | **Server (RSC + DAL)** | Dữ liệu đến từ backend                                | `features/<x>/server`                                                           |
| 2   | **URL**                | Cần share / bookmark / back-forward                   | `searchParams` đọc ở server; ghi bằng `Link` / `router` của `~/i18n/navigation` |
| 3   | **Global client**      | Nhớ qua phiên, không nên vào URL (vd mật độ hiển thị) | Redux qua facade `~/stores`                                                     |
| 4   | **Local**              | Chỉ dùng trong một component                          | `useState`                                                                      |

App không có thư viện server-cache phía client hay URL state phía client: TanStack Query và `nuqs` đã gỡ ở SHOP-45 (PR #32) vì không còn chỗ dùng (→ §10.4, §10.5).

## 10.2 Không nhét dữ liệu server vào global store — `[MUST]`

```
❌ Redux chứa danh sách product tải từ backend
✅ Redux chỉ chứa client/UI state thuần (density, sidebar open, …)
```

Dữ liệu server do RSC + DAL lo, ở lần tải đầu và mỗi lần URL đổi. Đưa nó vào store = tự tay tái tạo cache, tự tay xử lý stale — và luôn sai.

## 10.3 Redux đứng sau facade — `[MUST]`

- Feature/app **không** được import `react-redux` hay `@reduxjs/toolkit`. ESLint `no-restricted-imports` chặn, chỉ `src/stores/**` được phép.
- Feature dùng **facade hướng-domain**:

  ```ts
  // ✅
  import { useDensity } from '~/stores/use-density';
  const { density, set } = useDensity();

  // ❌
  import { useSelector } from 'react-redux';
  ```

- Giá trị của seam: đổi RTK ↔ Zustand = viết lại nội bộ `src/stores/*`, feature **không sửa một dòng**.

Hai rule kỹ thuật bắt buộc:

- **[MUST]** `makeStore` tạo store **mỗi request** — singleton sẽ rò state giữa các user khi SSR.
- **[MUST]** Persist localStorage phải **SSR-safe**: không đọc localStorage lúc render (gây hydration mismatch) → đọc **sau khi mount** rồi dispatch + subscribe.

## 10.4 Server-state phía client — tạm ngưng

App **không có** server-cache phía client. `~/lib/query`, `QueryProvider`, `getQueryClient` và thư mục `features/<x>/api/` không còn: SHOP-45 gỡ chúng cùng `@tanstack/react-query` vì không còn chỗ dùng.

- **[SHOULD]** Client Component không gọi `fetch` để đọc dữ liệu hiển thị. Cần dữ liệu mới sau lần tải đầu → đổi URL (§10.5) hoặc `router.refresh()`, để server render lại qua DAL. Plan `docs/specs/SHOP-7/plan.md` (Architecture Decisions 10) chọn cách này cho nút Xem thêm: `router.replace` với `page + 1`, không fetch phía client.
- Muốn dựng lại server-cache phía client → PR riêng: thêm dependency (§00; NFR13 của Epic SHOP-7 không cho thêm dependency), rồi viết lại setup và rule ở mục này (MINOR).

## 10.5 URL state — `searchParams` đọc ở server — `[MUST]`

```tsx
// page.tsx — không await searchParams ở page, truyền Promise xuống phần động
return (
  <Suspense fallback={null}>
    <ProductResults searchParams={searchParams} />
  </Suspense>
);
```

```ts
// bên trong phần động (Server Component async)
const query = parseSearchParams(productQuerySchema, await searchParams);
```

- **[MUST]** Đọc `searchParams` (Promise ở Next 16) **bên trong `<Suspense>`**: đọc là request-time, nên phần còn lại của trang giữ trong static shell (→ §07). Minh chứng: `src/app/[locale]/products/page.tsx`.
- **[MUST]** Parse bằng schema **tha thứ** (`.catch()` / `.default()`) qua `~/lib/validation/parse-search-params` (→ §08): URL rác về mặc định, không sập trang.
- **[MUST]** Ghi URL bằng `Link` hoặc `router.replace` / `router.push` của `~/i18n/navigation`. Component **ghi** và component **đọc** dùng **cùng tên param + cùng schema** → export chung một chỗ ở `features/<x>/model/*-query.ts`. Khi đổi một param, dựng lại query từ các giá trị đã parse để giữ các param còn lại.
- `nuqs` (`useQueryState`, `NuqsAdapter`) đã gỡ ở SHOP-45. Plan SHOP-7 (Architecture Decisions 10, 11) để URL là nguồn sự thật và để server render lại theo URL.

## 10.6 Provider phải nằm trong dynamic hole — `[MUST]`

Đây là bẫy đắt nhất của chương này.

```tsx
// ❌ provider client-state ở root layout → build vỡ:
//    "Math.random() in Client Component" (Redux seed) hoặc lỗi blocking-route
<StoreProvider>{children}</StoreProvider>

// ✅ scope provider vào đúng nơi dùng, BÊN TRONG <Suspense>
<Suspense fallback={<Skeleton />}>
  <StoreProvider>
    <DensityScopedList />
  </StoreProvider>
</Suspense>
```

Lý do: Redux seed bằng `Math.random()` lúc khởi tạo → không sống được trong static shell của PPR (→ §07). Hiện chưa màn hình nào dùng `StoreProvider`; chỉ `renderWithProviders` của test bọc nó (→ §17).

## 10.7 Bảng quyết định nhanh — `[SHOULD]`

| Câu hỏi                                                       | → Nhà chứa                                         |
| ------------------------------------------------------------- | -------------------------------------------------- |
| Dữ liệu này đến từ backend?                                   | RSC + DAL                                          |
| User có muốn gửi link cho người khác và thấy đúng trạng thái? | URL (`searchParams`)                               |
| Cần dữ liệu mới sau khi trang đã tải?                         | Đổi URL hoặc `router.refresh()`, server render lại |
| Cần nhớ qua lần truy cập sau, nhưng không nên nằm trong URL?  | Redux persisted (qua facade)                       |
| Chỉ một component quan tâm?                                   | `useState`                                         |
