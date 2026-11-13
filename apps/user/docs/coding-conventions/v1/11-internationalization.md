# 11 — Internationalization (i18n)

> Engine: `next-intl` với i18n routing, lắp trên khung `app/[locale]/` (→ §06).

## 11.1 Cấu trúc — `[MUST]`

| File                     | Vai trò                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `src/config/i18n.ts`     | **SSOT**: `locales`, `defaultLocale`, type `Locale`, guard `isLocale` — 0 dependency |
| `src/i18n/routing.ts`    | `defineRouting(...)` đọc từ `config/i18n`                                            |
| `src/i18n/navigation.ts` | `createNavigation` → `Link` / `redirect` / `usePathname` / `useRouter` locale-aware  |
| `src/i18n/request.ts`    | `getRequestConfig` → `{ locale, messages }` mỗi request                              |
| `src/proxy.ts`           | `createMiddleware(routing)`                                                          |
| `messages/{en,vi}.json`  | Catalog, đặt ở **gốc dự án** (ngoài `src/`)                                          |

Thêm locale mới = sửa **`config/i18n.ts`** + thêm file trong `messages/`. Không sửa rải rác nơi khác.

## 11.2 Namespace — `[MUST]`

- Đơn vị tổ chức là **namespace**, không phải file. Namespace **PascalCase**, thường tương ứng một feature: `Home`, `Products`, `Auth`, `Theme`, `Validation`.
- **[MUST]** Key không trùng giữa các namespace.
- **[MUST]** Thêm key phải thêm cho **cả `en.json` và `vi.json`** cùng lúc — thiếu một bên sẽ lỗi type.

**Khi nào tách file:** hiện tại **1 file / locale**. Tách thành `messages/<locale>/<feature>.json` chỉ khi catalog thực sự lớn; khi đó phải đồng bộ **2 chỗ**: merge (spread) trong `request.ts` và intersect type (`typeof a & typeof b`) trong `global.d.ts`.
❌ **Không** merge động bằng glob — type sẽ thành `any`, mất toàn bộ type-safety.

## 11.3 Dịch ở server hay client — `[MUST]`

| Ngữ cảnh                               | API                                                                  |
| -------------------------------------- | -------------------------------------------------------------------- |
| Server Component **đồng bộ**           | `useTranslations('Ns')`                                              |
| Page/layout **async** (`await params`) | `getTranslations()`                                                  |
| Client Component                       | `useTranslations('Ns')`                                              |
| `generateMetadata`                     | `getTranslations({ locale })` — truyền locale **tường minh** (→ §16) |

**[MUST]** Ưu tiên dịch **ở server** rồi truyền chuỗi xuống client. Server Component dịch ở server nên **không ship catalog** — đây là lý do tách file messages **không** làm giảm bundle client.

## 11.4 Giữ trang tĩnh — `[MUST]`

- Gọi `setRequestLocale(locale)` ở **mọi** layout và page.
- `NextIntlClientProvider` bọc ở `app/[locale]/layout.tsx` (v4 tự kế thừa messages/locale từ `getRequestConfig`).
- ❌ **Không** gọi `getTranslations` bên trong scope `'use cache'` (→ §07). Giải i18n ở orchestrator, truyền **string** xuống.

## 11.5 Type-safe key — `[MUST]`

`global.d.ts` khai:

```ts
import messages from './messages/en.json'; // ⚠️ import top-level BẮT BUỘC
declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof messages;
  }
}
```

- ⚠️ File **phải là module**. Thiếu `import` top-level → `declare module` trở thành ambient **thay thế** → lỗi "has no exported member" khắp dự án.
- **[MUST]** Không dùng **key động**: `t(someString)` sẽ lỗi type. Cần map theo code → build sẵn `Record<code, string>` với key tĩnh ở server rồi tra map ở client (→ §09).

## 11.6 Nội dung message — `[MUST]`

- Interpolation: `"greeting": "Xin chào {name}"`.
- Plural theo ICU: `en` cần `one`/`other`; `vi` chỉ `other`.
- ❌ Không nối chuỗi thủ công để dựng câu — luôn dùng interpolation, nếu không sẽ vỡ khi dịch sang ngôn ngữ khác trật tự.
- Mã lỗi validation là **snake_case, locale-agnostic** (`too_short`), nằm trong namespace `Validation` (→ §08).

## 11.7 Đổi ngôn ngữ — `[MUST]`

`LanguageSwitcher` (`~/components/language-switcher.tsx`) dùng **full reload**:

```ts
window.location.replace(getPathname({ href: pathname, locale }));
```

❌ **Không** dùng `router.replace(pathname, { locale })`.

**Vì sao:** soft-nav sẽ re-render layout `[locale]` (nơi sở hữu `<html>`) trên **client** → next-themes bị gạt class `.dark` mất một frame → **chớp trắng** ở dark mode, kèm cảnh báo "Encountered a script tag" của React 19. Full reload cho script anti-FOUC chạy trước paint. Đánh đổi: mất soft-nav riêng cho thao tác đổi ngôn ngữ (rất hiếm) — chấp nhận được.

## 11.8 Test — `[SHOULD]`

- `renderWithProviders` (`~/testing/render.tsx`) đã bọc `NextIntlClientProvider` với **messages thật** + option `locale` → test khẳng định được cả bản dịch en lẫn vi.
- Component dùng `~/i18n/navigation` → `vi.mock('~/i18n/navigation')` (createNavigation không resolve được `next/navigation` trong Vitest).
