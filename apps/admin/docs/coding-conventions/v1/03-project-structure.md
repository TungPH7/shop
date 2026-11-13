# 03 — Project Structure

> Ba tầng, một chiều: **shared → features → app**. Vi phạm là lỗi lint, không phải góp ý.

## 3.1 Cây thư mục

```
src/
├── app/            # TẦNG APP — compose mọi thứ lại. Chỉ tầng này được import features/
│   ├── routes.tsx          # bảng route (dữ liệu thuần)
│   ├── router.ts           # tạo router instance
│   ├── provider.tsx        # AppProvider — bọc toàn bộ provider
│   ├── layouts/            # layout dùng chung (root-layout)
│   ├── routes/             # route component mỏng, chỉ compose feature
│   ├── configure-auth.ts   # cắm seam auth 1 lần lúc bootstrap
│   ├── observability.ts    # cắm seam logger/monitoring/analytics 1 lần
│   └── app-error-boundary.tsx
├── features/       # TẦNG FEATURE — mỗi feature tự chứa, không biết nhau
│   └── <feature>/
│       ├── api/            # fetch + query/mutation hook của feature
│       ├── components/
│       ├── hooks/
│       ├── lib/            # hàm thuần riêng của feature
│       └── model/          # Zod schema + type suy ra từ schema
├── components/     # ┐
├── config/         # │
├── hooks/          # │ TẦNG SHARED — dùng chung, không biết features/ hay app/
├── lib/            # │ (wrapper thư viện bên thứ ba: api, react-query, i18n,
├── stores/         # │  logger, monitoring, analytics, notifications, security…)
├── testing/        # │
├── types/          # │
└── utils/          # ┘
```

Tầng shared gồm đúng 9 thư mục: `components`, `hooks`, `lib`, `stores`, `types`, `utils`, `config`, `assets`, `testing`.

## 3.2 Layering

### PS-001 [MUST] Dependency đúng một chiều: shared → features → app

- `shared/*` **không** import từ `features/` hay `app/`.
- `features/*` **không** import từ `app/`.
- Chỉ `app/` được import `features/`.

**Enforce:** `import-x/no-restricted-paths` (zone-based) → `pnpm lint`

### PS-002 [MUST] Cấm cross-feature import

Feature A **không** import bất cứ thứ gì của feature B. Cần dùng chung:

| Thứ cần chia sẻ | Cách làm |
|---|---|
| Hàm/type/component thuần | Nâng lên `shared` |
| UI của A cần bị chi phối bởi B | **Compose ở `app/`** — A nhận slot `ReactNode`, không biết B tồn tại |

✅
```tsx
// features/product/components/product-detail.tsx
interface ProductDetailProps { product: Product; actions?: ReactNode }
```
```tsx
// app/routes/products/product-detail-route.tsx  ← chỉ tầng app biết cả hai
<ProductDetail product={product} actions={<Can method="DELETE" path="/products"><DeleteButton /></Can>} />
```
❌ `features/product/...` import `features/auth/components/can`

**Enforce:** `import-x/no-restricted-paths` — **thêm feature mới phải thêm một zone cross-feature cho nó** trong `eslint.config.js`.

### PS-003 [MUST] Không có barrel file

Không tạo `index.ts` / `index.tsx` re-export. Import thẳng tới file đích.

✅ `import { ProductCard } from '@/features/product/components/product-card';`
❌ `import { ProductCard } from '@/features/product';`

**Enforce:** `check-file/no-index`

### PS-004 [MUST] Absolute import qua alias `@/`

Dùng `@/*` (= `src/*`) cho mọi import xuyên thư mục. Relative import chỉ dùng trong cùng thư mục hoặc thư mục con trực tiếp.

✅ `import { api } from '@/lib/api/api';` ❌ `import { api } from '../../../lib/api/api';`

## 3.3 Đặt file ở đâu

### PS-005 [MUST] Mặc định là trong feature; nâng lên shared khi có ≥ 2 nơi dùng

Code mới **luôn** bắt đầu ở `features/<x>/`. Chỉ nâng lên `shared` khi thực sự có feature thứ hai cần đến. Không nâng trước vì "chắc sau này dùng".

### PS-006 [MUST] `lib/` bọc thư viện bên thứ ba, không chứa logic nghiệp vụ

`src/lib/<tên>/` là nơi **duy nhất** cấu hình và bọc một thư viện ngoài (axios, TanStack Query, i18next, DOMPurify…). Logic nghiệp vụ thuộc về `features/`.

`utils/` chứa hàm thuần, không phụ thuộc thư viện ngoài, không phụ thuộc React.

### PS-007 [MUST] Route component ở `app/routes/` phải mỏng

File trong `app/routes/` chỉ được: đọc param, compose component của feature, bơm slot. **Không** chứa UI phức tạp hay logic nghiệp vụ — những thứ đó thuộc `features/<x>/components/`.

### PS-008 [SHOULD] Không tạo thư mục rỗng "cho đủ bộ"

Tạo `api/`, `hooks/`, `model/`… khi thực sự có file bỏ vào. Cấu trúc ở §3.1 là bộ khung tối đa, không phải checklist bắt buộc cho mọi feature.

### PS-009 [MUST] Test nằm cạnh file được test

`product-list.tsx` ↔ `product-list.test.tsx` cùng thư mục. Không có thư mục `__tests__/` tập trung. → `16-testing.md`

## 3.4 Cấu trúc một feature

Một feature hoàn chỉnh (tham chiếu: `features/product/`):

| Thư mục | Chứa gì | Ví dụ |
|---|---|---|
| `model/` | Zod schema + `type X = z.infer<...>` | `product.ts` |
| `api/` | 1 file / 1 thao tác + key factory | `get-products.ts`, `create-product.ts`, `query-keys.ts` |
| `components/` | UI của feature | `product-list.tsx`, `product-create-form.tsx` |
| `hooks/` | Hook riêng của feature | `use-product-filters.ts` |
| `lib/` | Hàm thuần, testable độc lập | `permission.ts` |

Thêm feature mới = copy đúng bộ này + thêm zone cross-feature vào `eslint.config.js` (PS-002).
