# 05 — TypeScript

> Tier **strictest**: chặt hơn `strict: true` khá nhiều. Nghiêm với code của mình, khoan dung với `node_modules` (`skipLibCheck: true`).

## 5.1 Cấu hình

### TY-001 [MUST] Không nới lỏng strictness ở cấp file hay cấp project

`tsconfig.base.json` bật (ngoài `strict`): `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `erasableSyntaxOnly`, `isolatedModules`, `verbatimModuleSyntax`.

Cấm `// @ts-nocheck`. `// @ts-expect-error` phải kèm lý do trên cùng dòng comment và là lựa chọn cuối.

✅ `// @ts-expect-error — lib types say string, runtime gives Date (upstream issue #123)`
❌ `// @ts-ignore`

### TY-002 [MUST] `tsc` phải xanh — Vite **không** type-check khi build

`vite build` chỉ transpile. Type-check là bước riêng: `pnpm typecheck` (và `pnpm build` đã chạy `tsc -b` trước).

**Enforce:** CI job `verify`

## 5.2 Kiểu

### TY-003 [MUST] Không dùng `any`

Cần "thoát kiểu" → dùng `unknown` rồi thu hẹp bằng type guard.

✅
```ts
function isApiError(e: unknown): e is ApiError { ... }
```
❌ `catch (e: any) { console.log(e.message) }`

**Enforce:** `@typescript-eslint/no-explicit-any`

### TY-004 [MUST] `interface` cho object/props, `type` cho union/tuple/mapped/hàm

✅
```ts
interface ProductCardProps { product: Product; onSelect?: (id: string) => void }
type ProductStatus = 'draft' | 'published' | 'archived';
```

### TY-005 [MUST] Không dùng `enum`

Dùng union literal hoặc object `as const`. (`erasableSyntaxOnly` chặn ở compiler.)

✅
```ts
export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];
```
❌ `enum Role { Admin, User }`

### TY-006 [MUST] Type-only import phải ghi rõ

`verbatimModuleSyntax` bật ⇒ import chỉ dùng cho kiểu phải đánh dấu.

✅ `import { type Product, productSchema } from '@/features/product/model/product';`
❌ `import { Product } from '...'` (khi `Product` chỉ là type)

**Enforce:** `@typescript-eslint/consistent-type-imports` (`inline-type-imports`)

### TY-007 [SHOULD] Mô hình hóa state bằng discriminated union

Loại bỏ trạng thái "không thể xảy ra" ngay ở tầng type.

✅ `type Result = { status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'success'; data: Product }`
❌ `{ isLoading: boolean; error?: E; data?: T }` — cho phép cả `isLoading && error && data`.

### TY-008 [MUST] Chú ý `noUncheckedIndexedAccess`

Truy cập phần tử mảng / index signature trả về `T | undefined`. Phải xử lý, không ép kiểu cho qua.

✅ `const first = items[0]; if (!first) return null;`
❌ `const first = items[0]!;`

### TY-009 [SHOULD] Không chú thích kiểu thừa

Để TypeScript suy luận khi đã rõ; chỉ khai kiểu ở **ranh giới công khai** (tham số hàm export, kiểu trả về của API, props).

✅ `const [count, setCount] = useState(0);` ❌ `const [count, setCount] = useState<number>(0);`

## 5.3 Ranh giới kiểu (type-at-boundary)

### TY-010 [MUST] Mọi dữ liệu ngoài phải validate bằng Zod tại điểm nhập

Áp dụng cho: API response, biến môi trường, dữ liệu form, query param, `localStorage`. Sau ranh giới, code tin vào type và không kiểm lại.

| Nguồn ngoài | Validate ở đâu |
|---|---|
| API response | Tầng api — truyền `schema` vào request (`08-api-layer.md`) |
| Biến môi trường | `src/config/env.ts`, lúc boot |
| Form | `zodResolver` (`10-forms-and-validation.md`) |
| URL query | nuqs parser (`09-state-management.md`) |
| `localStorage` | Khi đọc, có versioning (`09-state-management.md`) |

### TY-011 [MUST] `src/config/env.ts` là module duy nhất đọc biến môi trường

Không rải `import.meta.env` khắp nơi. `env.ts` validate bằng Zod và **fail-fast lúc boot** với thông báo gộp, dễ đọc. App import object `env` đã có kiểu.

✅ `import { env } from '@/config/env'; api.baseURL = env.VITE_API_URL;`
❌ `const url = import.meta.env.VITE_API_URL as string;`

### TY-012 [MUST] Mọi biến `VITE_*` đều là PUBLIC

Vite nướng biến `VITE_*` vào bundle client lúc **build** ⇒ ai cũng đọc được. Tuyệt đối không đặt secret ở đây. Thêm biến mới phải khai thêm ở `src/vite-env.d.ts`. → `17-security.md`

### TY-013 [SHOULD] Mở rộng kiểu của thư viện bằng module augmentation, không ép kiểu

Cần thêm kiểu cho lib (key i18n, `meta` của TanStack Query…) → viết file `*.d.ts` augment đúng interface của lib, thay vì `as` rải rác ở call-site.
