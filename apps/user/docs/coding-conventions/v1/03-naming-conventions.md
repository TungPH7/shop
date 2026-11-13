# 03 — Naming Conventions

> Phần lớn được ESLint (`eslint-plugin-check-file`) ép tự động; phần còn lại là bắt buộc khi review.

## 3.1 File & thư mục — `[MUST]`

| Đối tượng                   | Quy ước                            | Ví dụ                                                        |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| Mọi file dưới `src/`        | **kebab-case**                     | `get-current-user.ts`, `product-list.tsx`, `session-seal.ts` |
| Thư mục **ngoài** `src/app` | **kebab-case**                     | `features/caching-demo/`, `lib/http/`                        |
| Thư mục trong `src/app`     | Next quyết định                    | `[locale]`, `(marketing)`, `_private`                        |
| Unit test                   | `<tên>.test.ts(x)` **cạnh source** | `product.ts` → `product.test.ts`                             |
| E2E test                    | `e2e/<tên>.spec.ts`                | `e2e/auth.spec.ts`                                           |

- **[MUST]** Không có file `index.ts` / `index.tsx` (barrel) ở bất kỳ đâu — `check-file/no-index` chặn. Public API = import trực tiếp file đích + ranh giới tầng (§02).
- **[MUST]** Không dùng thư mục `__tests__/`. Test **colocated** cạnh source.

## 3.2 Component & file component — `[MUST]`

- Tên component: **PascalCase**; tên file: **kebab-case** khớp nghĩa.
  `ProductList` → `product-list.tsx` · `LanguageSwitcher` → `language-switcher.tsx`
- Một file = **một component export chính** (component con nhỏ dùng nội bộ thì được ở chung file).
- Hậu tố mang vai trò, dùng nhất quán:

| Hậu tố                  | Vai trò                                                 | Ví dụ thực tế                              |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------ |
| `*-view`                | Component **thuần đồng bộ**, chỉ nhận props → test được | `home-view.tsx`, `snapshot-view.tsx`       |
| `*-form`                | Client Component chứa form                              | `login-form.tsx`, `profile-edit-form.tsx`  |
| `*-panel`               | Server Component bọc form: guard + i18n + prefill       | `profile-edit-panel.tsx`                   |
| `*-button`              | Client island nhỏ, một hành động                        | `delete-product-button.tsx`                |
| `*-provider`            | Wrapper context                                         | `theme-provider.tsx`, `query-provider.tsx` |
| `*-shell` / `*-results` | Khung tĩnh / phần động trong PPR                        | `product-shell`, `product-results.tsx`     |

## 3.3 Hàm, biến, hằng — `[MUST]`

- Hàm & biến: **camelCase** — `getProducts`, `normalizeError`, `absoluteUrl`.
- Hằng module-level bất biến: **UPPER_SNAKE_CASE** — `THEME_OPTIONS`, `DELETE_PRODUCT_PERMISSION`.
- Boolean: tiền tố `is` / `has` / `should` / `can` — `isDev`, `hasLocalePrefix`, `canDelete`.
- Hàm trả boolean (type guard): `is*` — `isLocale`, `isAppError`, `isOk`.
- Biến/tham số **cố tình không dùng**: tiền tố `_` — ESLint đã cấu hình bỏ qua pattern `^_`.
  ```ts
  // ✅ giữ chữ ký chuẩn của Server Action dù không đụng prevState
  export async function deleteProductAction(_prevState: State, formData: FormData) { … }
  ```

## 3.4 Type & schema — `[MUST]`

- Type/interface: **PascalCase**, danh từ — `Product`, `AuthUser`, `ProfileFormState`.
- Schema Zod: **camelCase** + hậu tố `Schema` — `productSchema`, `loginSchema`, `productQuerySchema`.
- Type suy ra từ schema bằng `z.infer`, **không** khai trùng:

  ```ts
  // ✅
  export const productSchema = z.object({ id: z.number(), name: z.string() });
  export type Product = z.infer<typeof productSchema>;

  // ❌ khai 2 nguồn sự thật — sẽ lệch nhau
  export type Product = { id: number; name: string };
  ```

- Không đặt tiền tố `I` cho interface, không hậu tố `Type` cho type.

## 3.5 Hàm theo vai trò — `[SHOULD]`

| Tầng                       | Mẫu tên                         | Ví dụ                                                 |
| -------------------------- | ------------------------------- | ----------------------------------------------------- |
| DAL (`server/`)            | động từ + resource              | `getProducts`, `deleteProduct`, `updateProfile`       |
| Server Action (`actions/`) | động từ + resource + `Action`   | `loginAction`, `deleteProductAction`                  |
| Hook                       | `use*`                          | `useDensity`, `useProductCount`, `useHydrated`        |
| Builder / factory          | `create*` / `build*` / `make*`  | `createLogger`, `buildPageMetadata`, `makeStore`      |
| Mapper thuần               | `mapTo*` / `format*` / `parse*` | `mapToProduct`, `formatZodError`, `parseSearchParams` |
| Guard (server)             | `require*`                      | `requireUser`, `requireModule`                        |

## 3.6 i18n — `[MUST]`

- Namespace = **PascalCase**, một namespace cho một feature/khu vực — `Home`, `Products`, `Auth`, `Theme`, `Validation`.
- Key trong namespace: **camelCase** — `signInTitle`, `emptyState`.
- Mã lỗi validation dùng **snake_case, locale-agnostic** — `too_short`, `password_mismatch`, `credentials`. UI map sang `t('Validation.<code>')` (→ §08, §11).

## 3.7 Env & route — `[MUST]`

- Biến môi trường: **UPPER_SNAKE_CASE** — `API_URL`, `AUTH_SECRET`.
- Biến lộ ra client **bắt buộc** tiền tố `NEXT_PUBLIC_` — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`.
- Route path: chữ thường, kebab-case, danh từ số nhiều cho collection — `/products`, `/account/edit`, `/api/auth/refresh`.

## 3.8 Git — `[MUST]`

- Branch: `<type>/<mô-tả-ngắn-kebab>` — `feat/product-filters`, `fix/session-expiry`.
- Commit: **Conventional Commits**, subject **một dòng** (commitlint ép):
  ```
  feat: 25-ci-cd
  fix: reset MSW store giữa các lần chạy E2E
  docs: bổ sung chương state management
  ```
  Type hợp lệ: `feat` `fix` `docs` `refactor` `test` `chore` `build` `ci` `perf` `style` `revert`.
