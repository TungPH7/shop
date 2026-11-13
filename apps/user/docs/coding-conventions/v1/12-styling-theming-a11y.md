# 12 — Styling · Theming · Accessibility

## 12.1 Design token 2 tầng — `[MUST]`

Token nằm ở `src/styles/tokens.css`, chia **hai tầng**:

```css
:root {
  /* Tầng 1 — PRIMITIVE: palette thô (OKLCH), BẤT BIẾN, không dùng trực tiếp trong component */
  --blue-600: oklch(0.55 0.2 260);

  /* Tầng 2 — SEMANTIC: tầng DUY NHẤT được component dùng, và là tầng duy nhất bị lật theme */
  --background: …;
  --foreground: …;
  --primary: …;
  --danger: …;
  --surface: …;
  --muted: …;
  --border: …;
  --ring: …;
}

.dark {
  /* re-map SEMANTIC — không đụng primitive */
}
```

- **[MUST]** Component chỉ dùng token **semantic** (`var(--primary)`), ❌ không dùng primitive, ❌ không hardcode màu (`#3b82f6`, `rgb(...)`).
- **[MUST]** Thêm màu mới = thêm **semantic token** trước, rồi mới dùng. Không có "màu dùng một lần".
- `body { background: var(--background); color: var(--foreground) }` → đổi theme là repaint cả app.

## 12.2 Theme sáng/tối — `[MUST]`

Engine: **`next-themes`**, seam ở `~/components/theme-provider.tsx` (một chỗ duy nhất cấu hình: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`).

- **[MUST]** Dark mode bằng **class `.dark`** trên `<html>` (khớp quy ước Tailwind v4 / shadcn), không dùng media query trực tiếp trong component.
- **[MUST]** Không tự đọc cookie để quyết theme phía server. Cookie-based theme làm root layout đọc request-time → **vỡ static shell toàn app**, giết PPR mọi route (→ §07).
- **[MUST]** `color-scheme` do next-themes quản (`enableColorScheme`) → ❌ không khai `color-scheme` trong `tokens.css` (một chủ sở hữu).
- Provider đặt ở `app/[locale]/layout.tsx`, **ngoài** `NextIntlClientProvider` (để switcher có cả theme lẫn i18n); `{children}` server đi xuyên qua theo donut pattern (→ §05).

## 12.3 Brand / white-label — `[MAY]`

Trục brand **độc lập** với sáng/tối: `[data-theme="acme"]` re-map tầng semantic, ghép được với `.dark`.

Hiện tại: **token đã sẵn sàng, chưa có switcher runtime** — đúng nguyên tắc "đừng lắp seam sớm" (§01). Dựng switcher khi có brand thật thứ hai.

## 12.4 Hydration & client UI — `[MUST]`

```tsx
// ❌ useEffect + useState("mounted") — React Compiler bật rule react-hooks/set-state-in-effect và sẽ chặn
// ✅ dùng useSyncExternalStore
const hydrated = useSyncExternalStore(
  noop,
  () => true,
  () => false,
);
<button aria-pressed={hydrated && theme === value}>…</button>;
```

Server snapshot trả `false` → lần render đầu khớp server, trạng thái active bật **sau** hydrate → không mismatch.

`<html>` và `<body>` đã có `suppressHydrationWarning` để script anti-FOUC của next-themes sửa class trước hydrate mà không cảnh báo.

## 12.5 Accessibility — `[MUST]`

Hai lớp kiểm tra, **bổ sung** cho nhau:

| Lớp  | Công cụ                                                      | Bắt được                                          |
| ---- | ------------------------------------------------------------ | ------------------------------------------------- |
| Tĩnh | `eslint-plugin-jsx-a11y` (có sẵn trong `eslint-config-next`) | Thiếu alt, `onClick` trên `<div>`, label rời rạc… |
| Động | `@axe-core/playwright` trong `e2e/accessibility.spec.ts`     | Contrast, tên khả truy cập, DOM sau render        |

Rule bắt buộc:

- **[MUST]** Dùng **HTML ngữ nghĩa** trước (`<button>`, `<nav>`, `<main>`, `<ul>`), ARIA chỉ khi HTML không diễn đạt được.
- **[MUST]** Mọi input có `<label>` liên kết (`htmlFor` / bọc). Placeholder **không** thay được label.
- **[MUST]** Mọi `<img>` / `next/image` có `alt` (ảnh trang trí → `alt=""`).
- **[MUST]** Nhóm điều khiển dùng `role="group"` + `aria-pressed` / `aria-current` cho trạng thái (xem `theme-switcher.tsx`, `language-switcher.tsx`).
- **[MUST]** Thao tác được bằng bàn phím; không xoá focus outline mà không thay bằng focus style rõ ràng (token `--ring`).
- **[MUST]** Test query theo **vai trò**: `getByRole` / `getByLabelText`, ❌ không `querySelector` theo class (→ §17).
- **[SHOULD]** Contrast tối thiểu WCAG AA (4.5:1 chữ thường) — kiểm tra khi thêm/sửa semantic token, ở **cả** light và dark.

## 12.6 Viết CSS — `[SHOULD]`

- `src/app/globals.css` = reset + base + import `tokens.css`. Giữ mỏng.
- Style riêng của component đặt cạnh component; ❌ không dựng file CSS "global" thứ hai.
- ❌ Không dùng `!important` trừ khi override thư viện bên thứ ba, kèm comment lý do.
- Đơn vị: `rem` cho khoảng cách/chữ, tránh `px` cứng cho typography.
