# 04 — Naming Conventions

> Nhất quán quan trọng hơn lựa chọn cụ thể. Phần lớn mục dưới đây được lint bắt tự động.

## 4.1 File & folder

### NM-001 [MUST] File & folder trong `src/` dùng kebab-case

Áp dụng cho **mọi** loại file, kể cả file chứa React component.

✅ `product-card.tsx` · `use-product-list.ts` · `features/product/`
❌ `ProductCard.tsx` · `productCard.tsx` · `features/Product/`

**Enforce:** `check-file/filename-naming-convention` + `check-file/folder-naming-convention`

> Tên *file* kebab-case nhưng *component* PascalCase — không mâu thuẫn: React bắt buộc định danh component viết hoa đầu, còn tên file là quy ước của dự án.

### NM-002 [MUST] Tên file phản ánh export chính

Một file = một trách nhiệm rõ ràng, tên file suy ra được export chính của nó.

✅ `product-card.tsx` → `ProductCard` · `use-auth.ts` → `useAuth` · `sanitize-html.ts` → `sanitizeHtml`

### NM-003 [MUST] Không dùng tên vô nghĩa gom hàng

Cấm `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `types.ts` kiểu túi đựng đồ. Đặt tên theo việc file làm.

✅ `format-currency.ts` · `assert.ts` ❌ `utils.ts` chứa 20 hàm không liên quan

### NM-004 [SHOULD] Hậu tố theo vai trò

| Vai trò | Mẫu tên | Ví dụ |
|---|---|---|
| Route component (tầng app) | `<tên>-route.tsx` | `product-detail-route.tsx` |
| Layout | `<tên>-layout.tsx` | `root-layout.tsx` |
| Redux slice | `<domain>-slice.ts` | `ui-slice.ts` |
| Facade hook | `use-<domain>.ts` | `use-theme.ts` |
| Query key factory | `query-keys.ts` / `<domain>-keys.ts` | `query-keys.ts` |
| Test | `<file được test>.test.ts(x)` | `product-list.test.tsx` |
| E2E spec | `<luồng>.spec.ts` | `product-crud.spec.ts` |
| Type augmentation | `<lib>.d.ts` | `i18next.d.ts` |

### NM-005 [MUST] Một file API = một thao tác

Trong `features/<x>/api/`, mỗi file bọc đúng một thao tác, tên theo động từ + tài nguyên.

✅ `get-products.ts` · `get-product.ts` · `create-product.ts` · `update-product.ts` · `delete-product.ts`
❌ `product-api.ts` chứa cả 5 thao tác

## 4.2 Định danh trong code

### NM-006 [MUST] Bảng quy ước định danh

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| Component | PascalCase | `function ProductCard()` |
| Hook | `use` + camelCase | `useProductList` |
| Biến, hàm thường | camelCase | `fetchProducts` |
| Type / Interface | PascalCase | `interface User` · `type ProductStatus` |
| Props type | `<Component>Props` | `interface ProductCardProps` |
| Hằng số module-level | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Zod schema | `<tên>Schema` | `productSchema` · `createProductSchema` |
| Biến boolean | `is` / `has` / `should` / `can` | `isLoading` · `hasError` · `canEdit` |
| Prop nhận callback | `on<Event>` | `onSubmit` · `onRetry` |
| Hàm xử lý event | `handle<Event>` | `handleSubmit` |

### NM-007 [MUST] Type suy ra từ schema, không khai trùng

Zod schema là nguồn sự thật; type lấy bằng `z.infer`. Không viết tay một `interface` song song với schema (chắc chắn sẽ lệch).

✅
```ts
export const productSchema = z.object({ id: z.string(), name: z.string() });
export type Product = z.infer<typeof productSchema>;
```
❌ khai `interface Product` riêng bên cạnh `productSchema`.

### NM-008 [SHOULD] Tên nói ý nghĩa nghiệp vụ, không nói kiểu dữ liệu

✅ `retryDelayMs` · `unreadCount` ❌ `data2` · `tmpArr` · `flag`

Viết tắt chỉ dùng khi đã phổ biến trong domain (`id`, `url`, `api`, `i18n`, `a11y`).

### NM-009 [MUST] Handler `on*` là prop, `handle*` là hàm hiện thực

✅
```tsx
<ProductForm onSubmit={handleSubmit} />
```
❌ `<ProductForm handleSubmit={onSubmit} />`

## 4.3 Git

### NM-010 [MUST] Commit theo Conventional Commits

Dạng `type(scope?): subject` — subject viết thường, tiếng Anh, không dấu chấm cuối, **một dòng**.

Type hợp lệ: `feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `build` · `ci` · `perf` · `style` · `revert`.

✅ `feat: add product edit form` · `fix(api): normalize timeout error`
❌ `Update code.` · `feat: Thêm form sửa sản phẩm.`

**Enforce:** `commitlint` qua hook `commit-msg` → xem `19-tooling-git-ci.md`

### NM-011 [SHOULD] Tên branch: `<type>/<mô tả ngắn>`

Cùng bộ type với commit, mô tả kebab-case, tiếng Anh.

✅ `feat/product-edit-form` · `fix/api-timeout-normalize` ❌ `tung-dev` · `new-branch-2`

### NM-012 [SHOULD] Tên test mô tả hành vi, không mô tả hàm

✅ `it('shows a validation error when price is negative')`
❌ `it('test handleSubmit')`
