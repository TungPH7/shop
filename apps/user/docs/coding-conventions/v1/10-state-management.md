# 10 — State Management

> Server-first ⇒ client state phải **tối thiểu**. Câu hỏi đầu tiên luôn là: "state này có cần ở client không?"

## 10.1 Thang ưu tiên — `[MUST]`

Chọn từ trên xuống, chỉ đi tiếp khi phương án trên **không** đáp ứng được:

| #   | Nhà chứa state               | Dùng khi                                              | Công cụ                     |
| --- | ---------------------------- | ----------------------------------------------------- | --------------------------- |
| 1   | **Server (RSC + DAL)**       | Dữ liệu đến từ backend                                | `features/<x>/server`       |
| 2   | **URL**                      | Cần share / bookmark / back-forward                   | `nuqs`                      |
| 3   | **Server-cache phía client** | Fetch/refetch tương tác sau lần tải đầu               | TanStack Query              |
| 4   | **Global client**            | Nhớ qua phiên, không nên vào URL (vd mật độ hiển thị) | Redux qua facade `~/stores` |
| 5   | **Local**                    | Chỉ dùng trong một component                          | `useState`                  |

## 10.2 Không nhét dữ liệu server vào global store — `[MUST]`

```
❌ Redux chứa danh sách product tải từ backend
✅ Redux chỉ chứa client/UI state thuần (density, sidebar open, …)
```

Dữ liệu server đã có RSC + DAL (lần đầu) và TanStack Query (tương tác) lo. Đưa nó vào store = tự tay tái tạo cache, tự tay xử lý stale — và luôn sai.

## 10.3 Redux đứng sau facade — `[MUST]`

- Feature/app **không** được import `react-redux` hay `@reduxjs/toolkit`. ESLint `no-restricted-imports` chặn, chỉ `src/stores/**` được phép.
- Feature dùng **facade hướng-domain**:

  ```ts
  // ✅
  import { useDensity } from '~/stores/use-density';
  const { density, setDensity } = useDensity();

  // ❌
  import { useSelector } from 'react-redux';
  ```

- Giá trị của seam: đổi RTK ↔ Zustand = viết lại nội bộ `src/stores/*`, feature **không sửa một dòng**.

Hai rule kỹ thuật bắt buộc:

- **[MUST]** `makeStore` tạo store **mỗi request** — singleton sẽ rò state giữa các user khi SSR.
- **[MUST]** Persist localStorage phải **SSR-safe**: không đọc localStorage lúc render (gây hydration mismatch) → đọc **sau khi mount** rồi dispatch + subscribe.

## 10.4 TanStack Query — `[MUST]`

Dùng cho server-state **tương tác phía client** (RSC + DAL vẫn lo lần tải đầu).

- Setup ở `~/lib/query`: `getQueryClient` (server tạo mới / browser singleton) + `QueryProvider`.
- **[MUST]** Query hook đặt ở `features/<x>/api/` — component dùng hook, ❌ không gọi `fetch` hay `useQuery` trực tiếp trong component.
- **[MUST]** Client gọi Route Handler `/api/*` của ta (→ DAL → backend), không gọi backend trực tiếp.
- **[MUST]** Validate response bằng Zod ở biên, y như DAL (→ §08).

## 10.5 URL state — nuqs — `[MUST]`

```ts
const [view, setView] = useQueryState(
  'view',
  parseAsStringLiteral(['grid', 'list']).withDefault('grid'),
);
```

- Adapter: `NuqsAdapter` từ `nuqs/adapters/next/app`.
- **[MUST]** Component **ghi** và component **đọc** phải dùng **cùng key + cùng parser** → export chung một chỗ ở `model/*-view.ts`.
- **[MUST] Một nhóm param chỉ dùng một cơ chế URL-state.** ⚠️ Trộn form-GET (server nav) với nuqs sẽ làm mất param nuqs khi form dựng lại query string. Nếu buộc phải trộn → carry param tường minh.

## 10.6 Provider phải nằm trong dynamic hole — `[MUST]`

Đây là bẫy đắt nhất của chương này.

```tsx
// ❌ provider client-state ở root layout → build vỡ:
//    "Math.random() in Client Component" (Redux seed) hoặc lỗi blocking-route
<StoreProvider><NuqsAdapter>{children}</NuqsAdapter></StoreProvider>

// ✅ scope provider vào đúng nơi dùng, BÊN TRONG <Suspense>
<Suspense fallback={<Skeleton />}>
  <ProductProviders>       {/* Store + Nuqs + Query, chỉ cho vùng này */}
    <ProductResults />
  </ProductProviders>
</Suspense>
```

Lý do: Redux seed bằng `Math.random()` lúc khởi tạo, nuqs/TanStack đọc request-time → cả ba đều không sống được trong static shell của PPR (→ §07).

## 10.7 Bảng quyết định nhanh — `[SHOULD]`

| Câu hỏi                                                       | → Nhà chứa                   |
| ------------------------------------------------------------- | ---------------------------- |
| Dữ liệu này đến từ backend?                                   | RSC + DAL                    |
| User có muốn gửi link cho người khác và thấy đúng trạng thái? | URL (nuqs)                   |
| Cần refetch / polling / optimistic sau khi trang đã tải?      | TanStack Query               |
| Cần nhớ qua lần truy cập sau, nhưng không nên nằm trong URL?  | Redux persisted (qua facade) |
| Chỉ một component quan tâm?                                   | `useState`                   |
