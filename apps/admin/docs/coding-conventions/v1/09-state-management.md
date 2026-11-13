# 09 — State Management

> **Ba loại state, ba nơi ở.** Đặt nhầm chỗ là lỗi kiến trúc đắt nhất trong dự án React.

## 9.1 Phân loại

### ST-001 [MUST] Chọn nơi chứa state theo bảng này

| Loại state | Ví dụ | Nơi ở |
|---|---|---|
| **Server state** — bản sao dữ liệu của server | danh sách sản phẩm, profile người dùng | **TanStack Query** |
| **Client state** — UI, không tồn tại ở server | theme, sidebar đóng/mở | **Redux Toolkit** |
| **URL state** — cần chia sẻ / bookmark / back-forward | filter, search, phân trang | **nuqs** (query param) |
| **Local state** — chỉ một component quan tâm | input đang gõ, popover mở | **`useState`** trong component |

Mặc định là `useState`. Chỉ nâng lên global khi có **≥ 2** nơi thật sự cần.

### ST-002 [MUST] Không nhồi dữ liệu API vào Redux store

Không `createAsyncThunk` để fetch. Không slice `products` chứa danh sách lấy từ API. Cache, refetch, dedup, invalidate là việc của Query.

## 9.2 Server state — TanStack Query

### ST-003 [MUST] `QueryClient` tạo qua factory + singleton

`createQueryClient()` (không đọc env, dùng cho test) và `queryClient` (singleton cho app), đặt ở `src/lib/react-query/`.

### ST-004 [MUST] `retry: false` ở QueryClient

Tầng api đã retry (`API-007`). Bật cả hai ⇒ request nhân lên theo cấp số nhân.

### ST-005 [MUST] Query key khai bằng factory phân cấp, không viết tay tại chỗ

Đặt ở `features/<x>/api/query-keys.ts`, `as const`, phân cấp `all` → `lists()` → `detail(id)`.

✅
```ts
queryClient.invalidateQueries({ queryKey: productKeys.lists() });
```
❌ `invalidateQueries({ queryKey: ['products', 'list'] })` — gõ tay ở 5 nơi, lệch một chỗ là cache mốc.

### ST-006 [MUST] Query tái dùng khai bằng `queryOptions`, hook co-located với fetcher

Một file chứa cả ba: hàm fetch, `queryOptions`, hook. Cùng `queryOptions` dùng lại được cho `useQuery` và `prefetchQuery`.

```ts
// features/product/api/get-products.ts
export async function getProducts() { … }
export const productsQueryOptions = () => queryOptions({ queryKey: productKeys.lists(), queryFn: getProducts });
export const useProducts = () => useQuery(productsQueryOptions());
```

### ST-007 [MUST] Mutation phải invalidate/cập nhật cache tương ứng

| Thao tác | Cache |
|---|---|
| Create | `invalidateQueries(lists())` |
| Update | `invalidateQueries(lists())` + `setQueryData(detail(id), updated)` |
| Delete | `invalidateQueries(lists())` + `removeQueries(detail(id))` |

### ST-008 [MUST] Xử lý đủ `isPending` / `isError` / success ở nơi hiển thị

Đọc lỗi qua `isApiError(error)` để phân biệt 404 với lỗi khác. Vùng động phải có `role="status"` / `role="alert"`.

### ST-009 [SHOULD] Prefetch cho tương tác đoán trước được

Hover/focus vào link danh sách → `prefetchQuery(queryOptions)` để tránh waterfall click → fetch.

## 9.3 Client state — Redux Toolkit

### ST-010 [MUST] Component **không bao giờ** import `react-redux` / `@reduxjs/toolkit`

Chỉ `src/stores/**` được import hai thư viện này. Mọi nơi khác dùng **facade hook** theo domain.

✅ `const { theme, toggleTheme } = useTheme();`
❌ `const theme = useSelector((s) => s.ui.theme);`

**Enforce:** `no-restricted-imports` → `pnpm lint`

### ST-011 [MUST] Cấu trúc `src/stores/`

| File | Vai trò |
|---|---|
| `store.ts` | `makeStore()` factory + singleton + `RootState` / `AppDispatch` |
| `hooks.ts` | `useAppSelector` / `useAppDispatch` đã gắn kiểu |
| `store-provider.tsx` | `StoreProvider` — để tầng app không phải import `react-redux` |
| `<domain>/<domain>-slice.ts` | `createSlice` + selectors co-located |
| `<domain>/use-<domain>.ts` | **Facade** — bề mặt công khai của domain |
| `persistence.ts` | Đọc/ghi state cần lưu |

`makeStore(preloadedState)` là factory ⇒ mỗi test có store sạch.

### ST-012 [MUST] Selector trong facade phải hẹp

Select giá trị nguyên thủy cần dùng, không select cả object state. Select rộng ⇒ component re-render vì thứ nó không quan tâm.

✅ `useAppSelector(selectTheme)` ❌ `useAppSelector((s) => s.ui)`

### ST-013 [MUST] Persistence tự quản: có version, tối thiểu, validate khi đọc

`localStorage` là dữ liệu ngoài ⇒ đọc phải qua Zod (`CP-005`). Lưu `{ v, … }` có số version; shape lạ hoặc version cũ ⇒ bỏ qua và dùng mặc định, **không** crash. Chỉ ghi khi giá trị thật sự đổi. State phù du (sidebar) **không** persist.

## 9.4 URL state — nuqs

### ST-014 [MUST] State cần chia sẻ/bookmark phải nằm ở URL, không nhân bản vào store

Filter, từ khóa tìm kiếm, tab, phân trang → query param.

### ST-015 [MUST] Bọc nuqs trong facade hook của feature

✅ `const { search, setSearch } = useProductFilters();`
❌ Gọi `useQueryState('search')` rải rác trong nhiều component.

### ST-016 [SHOULD] Giá trị rỗng phải xóa param khỏi URL

Set `null` khi giá trị về mặc định/rỗng để URL sạch, chia sẻ được.

## 9.5 Provider

### ST-017 [MUST] Thứ tự provider cố định ở `AppProvider`

`StoreProvider` › `QueryClientProvider` › `RouterProvider`. Provider **cần** router context (adapter URL state) đặt trong layout gốc, không đặt ngoài router.

Test phải dựng đúng chồng provider này — dùng helper chung, không tự lắp lại. → `16-testing.md`
