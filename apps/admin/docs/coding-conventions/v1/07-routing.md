# 07 — Routing

> React Router v7 ở chế độ **data router**. Bảng route là dữ liệu thuần, đặt ở tầng `app/`.

## 7.1 Kiến trúc

### RT-001 [MUST] Dùng data router, không dùng router khai báo kiểu cũ

✅ `createBrowserRouter(routes)` + `<RouterProvider router={router} />`
❌ `<BrowserRouter><Routes><Route …/></Routes></BrowserRouter>`

Router khai báo không có data API, không hỗ trợ `lazy`/`ErrorBoundary` cấp route.

### RT-002 [MUST] Mỗi file một trách nhiệm trong chuỗi khởi tạo

| File | Trách nhiệm |
|---|---|
| `app/routes.tsx` | Bảng route (dữ liệu thuần) |
| `app/router.ts` | Tạo router instance từ bảng route |
| `app/provider.tsx` | `AppProvider` — bọc toàn bộ provider |
| `src/main.tsx` | Mount ứng dụng |

### RT-003 [MUST] Bảng route đặt ở `src/app/`, không đặt ở tầng shared

Bảng route phải import `features/` ⇒ chỉ tầng `app` được phép. Đặt ở `src/routes/` sẽ vi phạm layering (`PS-001`).

### RT-004 [MUST] Bảng route là dữ liệu thuần

Dùng `Component` / `ErrorBoundary` (tham chiếu component), không viết JSX trong bảng route.

✅ `{ path: 'products', Component: ProductsRoute }`
❌ `{ path: 'products', element: <ProductsRoute /> }`

**Ngoại lệ [MAY]:** route cần truyền prop cấu hình (vd guard theo module) thì dùng `element` với JSX — ghi comment nêu lý do.

### RT-005 [MUST] Layout dùng chung qua pathless layout route + `<Outlet />`

Vỏ app (nav, footer, provider cần router context) vẽ **một lần** ở layout route; route con render trong `<Outlet />`. Không lặp lại layout ở từng route (gây remount, mất state, nhấp nháy).

## 7.2 Đường dẫn

### RT-006 [MUST] Mọi URL khai ở `src/config/paths.ts`, không dùng magic string

`paths` khai `as const` kèm hàm `getHref()` có kiểu cho tham số. Tạo link **luôn** qua nó.

✅ `<Link to={paths.app.productDetail.getHref(product.id)}>`
❌ `<Link to={'/products/' + product.id}>`

Đổi cấu trúc URL ⇒ sửa một chỗ, TypeScript chỉ ra mọi call-site hỏng.

### RT-007 [MUST] Thu hẹp kiểu param trước khi dùng

`useParams()` trả `string | undefined`. Phải khẳng định trước khi dùng, không `!`.

✅
```ts
const { productId } = useParams();
invariant(productId, 'productId is required');
```
❌ `const { productId } = useParams(); fetch(productId!)`

## 7.3 Tải & lỗi

### RT-008 [MUST] Route phụ/nặng phải code-split bằng `lazy`

Dùng `lazy: async () => ({ Component: (await import('./x-route')).XRoute })` với **chuỗi literal** trong `import()` — bundler cần phân tích tĩnh.

Giữ **eager**: route critical path (trang chủ) và component nhỏ luôn cần (404).

### RT-009 [MUST] Route cha phải có `ErrorBoundary`

Lỗi trong một nhánh route không được làm trắng cả app. Dùng `useRouteError` + `isRouteErrorResponse` để phân biệt lỗi HTTP và lỗi render. → `12-error-handling.md`

### RT-010 [MUST] Route 404 (`path: '*'`) đặt cuối và nằm trong layout

Người dùng lạc trang vẫn phải thấy nav để đi tiếp.

### RT-011 [SHOULD] Hiện chỉ báo khi đang tải chunk lazy

`useNavigation().state === 'loading'` → render chỉ báo có `role="status"`, tránh cảm giác "bấm không ăn".

## 7.4 Ranh giới với tầng khác

### RT-012 [MUST] Route component chỉ compose, không chứa UI/logic nghiệp vụ

→ `PS-007`

### RT-013 [MUST] Không nhét cấu hình phân quyền vào bảng route

Bảo vệ route bằng **component guard bọc nhánh** (`ProtectedRoute`, `RequireModule`), không thêm cờ kiểu `isProtected: true` vào object route. → `11-auth-and-rbac.md`
