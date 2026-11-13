# 04 — TypeScript Conventions

> `pnpm typecheck` (`tsc --noEmit`) là gate bắt buộc. Không merge khi typecheck đỏ.

## 4.1 Compiler flags bắt buộc — `[MUST]`

`tsconfig.json` giữ các cờ sau; **không** hạ bất kỳ cờ nào để "cho code chạy":

| Cờ                                                           | Bắt được gì                                            |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `strict`                                                     | Bộ cờ nghiêm ngặt nền tảng                             |
| `noUncheckedIndexedAccess`                                   | `arr[0]` có thể `undefined` → buộc kiểm tra            |
| `exactOptionalPropertyTypes`                                 | Phân biệt "không có key" với "key = undefined"         |
| `verbatimModuleSyntax`                                       | Buộc `import type` tường minh cho import chỉ dùng type |
| `noImplicitOverride` · `noImplicitReturns`                   | Lỗi override/return sót nhánh                          |
| `noFallthroughCasesInSwitch` · `allowUnreachableCode: false` | Bug switch/code chết                                   |
| `forceConsistentCasingInFileNames`                           | Vỡ trên Linux CI vì khác hoa/thường                    |

- **[MUST]** `target: ES2022`, `moduleResolution: bundler`, `isolatedModules: true`.
- **[MUST]** `tsconfig.json` giữ **JSON thuần**, không comment — Next tự ghi lại file này, comment sẽ mất.
- **[MUST]** Alias khai **duy nhất** ở `paths: { "~/*": ["./src/*"] }`, không dùng `baseUrl`.

## 4.2 `any`, `unknown`, type assertion — `[MUST]`

- `@typescript-eslint/no-explicit-any: error` — **cấm `any`**.
- Dữ liệu chưa biết kiểu → `unknown`, rồi thu hẹp bằng Zod hoặc type guard.

  ```ts
  // ✅
  catch (e: unknown) {
    const error = normalizeError(e);
    if (error.kind === 'rate_limited') { … }
  }

  // ❌
  catch (e: any) { if (e.status === 429) { … } }
  ```

- `as` chỉ dùng khi bạn **biết chắc** hơn compiler và không có cách nào khác. Kèm comment giải thích. ❌ Không bao giờ `as any`.
- `!` (non-null assertion): tránh. Ưu tiên `if (!x) return` hoặc `??`.

## 4.3 `type` vs `interface` — `[SHOULD]`

Ưu tiên **`type`**. Chỉ dùng `interface` khi cần declaration merging (vd augment module bên thứ ba như `next-intl` `AppConfig` trong `global.d.ts`).

> Chưa enforce bằng lint — cố ý, để tránh xung đột với các augmentation về sau.

## 4.4 Import — `[MUST]`

- **Import type tường minh** (`consistent-type-imports: error`, cặp với `verbatimModuleSyntax`):

  ```ts
  // ✅
  import { type Product, productSchema } from '~/features/product/model/product';
  import type { NextConfig } from 'next';

  // ❌ — verbatimModuleSyntax sẽ giữ lại import runtime thừa
  import { Product } from '~/features/product/model/product';
  ```

  `eslint --fix` tự sửa được.

- **[MUST]** Luôn dùng alias `~/...`, không đường dẫn tương đối leo thư mục.
  - Ngoại lệ **duy nhất**: file nằm trên đường nạp `next.config.ts` (vd `./src/config/env/server`, `./src/config/security-headers`) — bộ biên dịch config của Next **không** áp `paths` của tsconfig.
- **[MUST]** Không tạo barrel (`index.ts` re-export). Import thẳng file đích.
- **[MUST]** Không import vòng (`import-x/no-cycle`).

## 4.5 Typing component React 19 — `[MUST]`

```tsx
// ✅ props khai bằng type, destructure ngay tại tham số
type ProductListProps = {
  products: readonly Product[];
  renderItemActions?: (product: Product) => ReactNode;
};

export function ProductList({ products, renderItemActions }: ProductListProps) { … }
```

- ❌ Không dùng `React.FC` (ẩn generic, kéo theo `children` không mong muốn).
- `children` khai tường minh: `children: ReactNode`.
- Với `exactOptionalPropertyTypes`, prop optional truyền có điều kiện phải **spread**, không truyền `undefined`:
  ```tsx
  // ✅
  <Component {...(locale ? { locale } : {})} />
  // ❌
  <Component locale={locale ?? undefined} />
  ```

## 4.6 Tổ chức type — `[MUST]`

| Loại type                                         | Nơi đặt                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Type của một feature                              | `features/<x>/model/*.ts` (cạnh schema sinh ra nó)                               |
| Type hạ tầng dùng chung                           | cạnh module định nghĩa nó trong `lib/` (vd `LogFields` ở `lib/logger/logger.ts`) |
| Type dùng chung nhiều nơi, không thuộc module nào | `src/types/`                                                                     |
| Augmentation module bên thứ ba                    | `global.d.ts` (gốc dự án)                                                        |

> ⚠️ `global.d.ts` **phải là module** (có ít nhất một `import`/`export` top-level). File script sẽ biến `declare module` thành ambient **thay thế** → lỗi "has no exported member" lan khắp dự án.

## 4.7 Quy ước nhỏ nhưng hay sai — `[MUST]`

- Biến/tham số cố tình không dùng → tiền tố `_` (ESLint đã bỏ qua pattern này).
- `readonly` cho props dạng mảng và hằng: `THEME_OPTIONS = [...] as const`.
- Không khai type cho giá trị đã suy ra được (`const n = 1`, không `const n: number = 1`).
- Type trả về của hàm export **[SHOULD]** khai tường minh khi hàm phức tạp hoặc thuộc public API của seam — giúp lỗi hiện tại chỗ định nghĩa thay vì chỗ dùng.
