# 08 — API Layer

> `src/lib/api/` là **transport thuần**: gọi HTTP, chuẩn hóa lỗi, validate shape. Nó không biết gì về UI và không biết gì về auth.

## 8.1 Client

### API-001 [MUST] Một instance HTTP duy nhất, tạo qua factory + singleton

`createApiClient(opts)` (factory, không đọc env) và `api` (singleton, lấy `baseURL` từ `env`). Factory tách khỏi singleton để test trỏ được sang mock server mà không đụng biến môi trường.

❌ Tạo `axios.create()` rải rác trong feature.

### API-002 [MUST] Bề mặt API trả thẳng dữ liệu, không rò rỉ kiểu của thư viện

`api.get<T>()` trả `T`, không trả `AxiosResponse<T>`. Feature không được import kiểu của axios.

✅ `const products = await api.get('/products', { schema: productListSchema });`
❌ `const res = await api.get(...); return res.data;` ở trong feature.

Đổi axios sang thứ khác ⇒ chỉ sửa `src/lib/api/`.

### API-003 [MUST] Không hiển thị UI trong interceptor

Interceptor **không** gọi toast, không điều hướng, không đụng store. Nó chuẩn hóa lỗi rồi ném ra. Quyết định hiển thị thuộc về caller / TanStack Query / Error Boundary. → `12-error-handling.md`

## 8.2 Lỗi

### API-004 [MUST] Mọi lỗi mạng chuẩn hóa về `ApiError`

`normalizeError` biến mọi thứ ném ra (lỗi axios, timeout, hủy request, lỗi Zod, lỗi lạ) thành một `ApiError` có `kind` phân loại (`network` · `timeout` · `canceled` · `validation` · `http` · `unknown`) kèm `status` / `code` / `details`.

### API-005 [MUST] Bắt lỗi bằng `isApiError`, không đoán bằng chuỗi

✅
```ts
if (isApiError(error) && error.status === 404) return <NotFound />;
```
❌ `if (error.message.includes('404'))`

## 8.3 Retry & auth

### API-006 [MUST] Chỉ retry request idempotent

Retry cho `GET` / `HEAD` / `OPTIONS` / `PUT` / `DELETE` với status 408 / 429 / 5xx. **Không** retry `POST`. Dùng exponential backoff + full jitter, tôn trọng `Retry-After`, có giới hạn số lần.

### API-007 [MUST] Tầng api là nơi retry **duy nhất**

TanStack Query cấu hình `retry: false`. Hai tầng cùng retry ⇒ số request nhân lên theo cấp số nhân. → `ST-004`

### API-008 [MUST] Auth cắm vào bằng seam, `lib/api` không import auth

`configureApiAuth({ getAccessToken, refreshTokens, onUnauthorized })` được gọi **một lần** lúc bootstrap ở tầng `app`. `lib/api` chỉ biết ba hàm này, không import feature auth (giữ layering + tránh phụ thuộc vòng).

### API-009 [MUST] 401 → refresh single-flight → retry đúng một lần

Nhiều request cùng nhận 401 phải **dùng chung một** lần refresh (single-flight), không mỗi request tự gọi refresh. Refresh thất bại → gọi `onUnauthorized()`. Bản thân request refresh phải đi bằng client trần, không qua interceptor (tránh đệ quy).

## 8.4 Dữ liệu

### API-010 [MUST] Validate response bằng Zod tại biên

Truyền `schema` vào request; sai shape ⇒ `ApiError` với `kind: 'validation'`. Backend đổi field ⇒ biết ngay tại chỗ, không lỗi `undefined` ở tầng UI ba màn hình sau.

✅ `api.get('/products', { schema: productListSchema })`
❌ `api.get<Product[]>('/products')` — ép kiểu mù, không kiểm chứng.

### API-011 [MUST] Data access đặt ở `features/<x>/api/`, một file một thao tác

Mỗi file: gọi `api.*`, truyền schema, trả domain type. Không gọi `api.*` trực tiếp từ component. → `NM-005`

```
features/product/api/
├── query-keys.ts
├── get-products.ts      # getProducts + productsQueryOptions + useProducts
├── create-product.ts    # createProduct + useCreateProduct
└── …
```

### API-012 [MUST] Schema là nguồn sự thật, type suy ra từ schema

Schema đặt ở `features/<x>/model/`. Schema phái sinh dùng toán tử của Zod, không viết lại.

✅ `export const createProductSchema = productSchema.omit({ id: true });`
❌ Khai một schema mới liệt kê lại toàn bộ field.

### API-013 [SHOULD] Đổi backend chỉ được ảnh hưởng `model/` + `api/` của feature

Contract (schema + lời gọi) gói gọn trong feature. Component không được phụ thuộc hình dạng JSON thô của backend.
