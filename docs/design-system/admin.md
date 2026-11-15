# Design system: admin

> **App:** `apps/admin` · **Nguồn:** bảng Design System của [docs/specs/SHOP-7/design.md](../specs/SHOP-7/design.md) · **Plan:** [docs/specs/SHOP-7/plan.md](../specs/SHOP-7/plan.md), Architecture Decisions mục 14 và 15 · **Cập nhật:** 2026-11-15, SHOP-8

Design system của `admin` là CSS variables và CSS thường, không có Tailwind hay thư viện UI (NFR13). Mỗi màn hình dùng token và class dưới đây, không tự đặt màu, cỡ chữ hay khoảng cách.

## Files

| File | Nội dung |
|---|---|
| `apps/admin/src/styles/tokens.css` | Mọi token: màu, chữ, khoảng cách, bo góc, bóng, kính, chuyển động; font dự phòng |
| `apps/admin/src/styles/global.css` | Nền trang, chữ thân, h1–h3, liên kết, vòng focus |
| `apps/admin/src/styles/components.css` | Class dùng chung: nút, huy hiệu, thẻ kính, ô nhập, bảng, banner, khung xương, khung trang |
| `apps/admin/public/theme-init.js` | Script thường, chặn render, trong `<head>` của `index.html`: đặt giao diện đã lưu lên `<html>` trước khung hình đầu tiên |
| `apps/admin/src/main.tsx` | Nạp font, rồi `tokens.css`, `global.css`, `components.css` theo thứ tự đó; cho `<html>` theo mọi lần đổi giao diện của store |
| `apps/admin/src/stores/theme/apply-theme.ts` | `applyTheme`, `syncThemeToDocument`: đặt hay gỡ `data-theme` trên `<html>` theo store |
| `apps/admin/src/components/theme/theme-switcher.tsx` | Ô chọn Sáng, Tối, Hệ thống ở khung trang |
| `apps/admin/src/app/layouts/root-layout.tsx` | Khung trang S1.1 |

## Theme

- Mặc định theo giao diện của hệ thống (`prefers-color-scheme`). Store `theme` mặc định là `system`, và `system` nghĩa là `<html>` không có `data-theme`.
- Ô chọn Giao diện (Sáng, Tối, Hệ thống) ở viên thuốc bên phải đặt `data-theme="light"` hay `"dark"`, hoặc gỡ nó với Hệ thống. Lựa chọn lưu ở `localStorage` (`tungph7.theme`). Khi tải trang, `public/theme-init.js` đọc nó và đặt `data-theme` trước khung hình đầu tiên, vì nó là script thường trong `<head>`, chạy trước khi trình duyệt vẽ; module script `main.tsx` chỉ chạy sau khi trang đã parse xong. Script là file riêng, không viết inline, để CSP `script-src 'self'` (`apps/admin/docs/conventions.md`) vẫn cho chạy. Nó đọc đúng khóa, số version và giá trị mà `saveTheme` ghi; đổi `persistence.ts` thì đổi cả nó (test `src/theme-init.test.ts` ghi bằng `saveTheme` rồi đọc lại).
- Token màu viết bằng `light-dark(sáng, tối)`, theo `color-scheme` của `:root`. Bản build chuyển nó sang biến `--lightningcss-light` và `--lightningcss-dark` cho trình duyệt cũ hơn. Hai token bóng không phải màu, nên giá trị tối của chúng khai báo một lần ở `--card-shadow-dark` và `--button-shadow-dark`; khối `[data-theme='dark']` và `@media (prefers-color-scheme: dark)` cuối `tokens.css` chỉ trỏ `--card-shadow` và `--button-shadow` tới đó.

## Tokens

Cột "Trạng thái" theo bảng của `design.md`: mọi dòng ở đó là "mới", và SHOP-8 đã thêm chúng. Giá trị ghi "ước lượng" là ước lượng của `ux`, chưa đo lại; plan giao việc đo bằng chrome-devtools trên trang mẫu cho SHOP-10 (design system của `user`). Checklist của SHOP-10 chỉ ghi số đo vào `docs/design-system/user.md`, nên SHOP-8 đã nhờ `ba` (comment trên SHOP-10) thêm việc ghi số đo vào file này và sửa `tokens.css` của `admin` khi số đo khác ước lượng. Tới khi đó, các giá trị "ước lượng" ở đây vẫn chưa đối chiếu.

### Màu

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--bg`, `--bg-from`, `--bg-to` | #f2f4f8; gradient 135° #eef1f6 → #f6f8fb | #111113; gradient 135° #0c0c0e → #131316 | Nền `<html>` và gradient của `<body>` |
| `--surface` | #ffffffb8 | #1e1e226b | Thẻ kính, viên thuốc; đi cùng `--blur`, `--sat` |
| `--solid` | #ffffff | #1d1d21 | Thay `--surface` khi không có `backdrop-filter` hay khi bật giảm độ trong suốt |
| `--dialog` | #fffffff0 | #1c1c20db | Hộp thoại và toast (SHOP-9) |
| `--text` | #0f1724 | #f6f8fc | Chữ chính, nhãn trường |
| `--muted` | #3b475a | #c9d1de | Chữ phụ, tiêu đề cột bảng, huy hiệu Ẩn |
| `--hint` | #556074 | #9aa1ad | Gợi ý, placeholder, slug dưới tên, giá gốc |
| `--control-border` | #667184 | #7d8696 | Viền ô nhập, ô chọn, vùng văn bản; từ 3:1 (WCAG 1.4.11) |
| `--line`, `--line-2` | #0f17241a, #0f17242e | #ffffff1a, #ffffff2e | Đường kẻ; viền nút phụ, mục đang chọn của nút phân đoạn |
| `--surface-2`, `--well` | #0f17240d, #0f17240d | #ffffff14, #c8c8d71a | Nền nút phụ, ô nhập, mục đang chọn của viên thuốc; ô "well" |
| `--accent` | #2b63c4 | #7aaef0 | Nền nút chính |
| `--on-accent` | #ffffff | #071a33 | Chữ trên `--accent` |
| `--accent-text` | #1a56b0 | #a9cdfc | Liên kết, chữ nhấn |
| `--accent-line` | #2a5db8 | #8dbcf6 | Vòng focus, viền ô đang focus |
| `--good-text`, `--good-fill` | #166534, #2f9e5b | #8fdca8, #5fc483 | Huy hiệu Còn hàng |
| `--bad-text`, `--bad-fill` | #b42318, #d4493c | #f6a59c, #e98278 | Lỗi ô nhập, huy hiệu "-16%", chữ nút Xóa ở dòng |
| `--warn-text`, `--warn-fill` | #8a5300, #c98a08 | #f3cd7e, #e4b759 | Huy hiệu Hết hàng, cảnh báo đổi slug |
| `--info-text`, `--info-fill` | #1a56b0, #2b63c4 | #a9cdfc, #7aaef0 | Huy hiệu Đang bán |
| `--good-tint`, `--bad-tint`, `--warn-tint`, `--info-tint` | fill ở 14% | fill ở 16% | Nền huy hiệu và banner |
| `--destructive`, `--on-destructive` | #b42318, #ffffff | #e98278, #1a0a08 | Nút nguy hiểm (nút Xóa của S3) |
| `--focus-halo` | `--accent` ở 18% | như bên trái | Vầng 3 px quanh ô đang focus |
| `--group-<tên>-from`, `-to`, `-text` | blue #354a6a → #283953, #eef4fd; coral #6a423d → #52322e, #fdeeeb; green #375741 → #29432f, #eef9f1; orange #66503a → #4e3d2b, #fdf3e6; teal #31574f → #24433d, #ecf8f5; ink #3b3e46 → #2c2e34, #f1f2f5 | giống bên trái | Ô giữ chỗ của sản phẩm (gradient 160°), dùng ở SHOP-9 |

Tương phản: `ux` đã tính mọi cặp chữ và nền ở hai giao diện (từ 4,5:1). SHOP-8 kiểm lại trên trình duyệt bằng axe 4.12.1 (WCAG 2.0, 2.1, 2.2 A và AA) ở trang chủ và trang Giới thiệu, sáng và tối: không có vi phạm. Các nút axe để "incomplete" vì nền kính trong suốt được tính tay bằng cách chồng các lớp nền: thấp nhất 6,81:1 (sáng) và 10,98:1 (tối).

### Chữ

| Token | Giá trị | Ghi chú |
|---|---|---|
| `--font` | `'Be Vietnam Pro', 'Be Vietnam Pro Fallback', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` | Xem mục Font |
| `--fs-2xs` … `--fs-display` | 11, 12, 12,5, 13,5, 14, 15, 17, 20, 22, 26, 34 px (`2xs`, `xs`, `sm`, `md`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `display`) | |
| `--lh-base` | 20,3 px | Chữ thân 14/20,3 |
| `--fw-regular`, `--fw-semibold`, `--fw-bold` | 500, 600, 700 | Chỉ ba độ đậm có file font |

| Vai trò | Giá trị | Ở đâu |
|---|---|---|
| Chữ thân, nhãn trường | 14/20,3, 500 | `body`, `.label` |
| Tiêu đề trang (h1) | 34/36, 700, letter-spacing -0,3 px. Ước lượng | `global.css` `h1` |
| Tiêu đề hộp thoại, h2 | 20/29, 700, letter-spacing -0,3 px | `global.css` `h2` |
| Nút chính, nút hộp thoại | 13,5/19,6, 600 | `.btn` |
| Nút phụ nhỏ, huy hiệu, nút phân đoạn | 12,5/18,1, 600 (huy hiệu 12/600) | `.btn--sm`, `.badge` |
| Tiêu đề cột bảng | 12/17,4, 600 | `.table th` |
| Giá | Thẻ 17/700; chi tiết 34/700; giá gốc 13,5/500 gạch ngang | Dùng ở `user`; `admin` hiện giá trong bảng bằng chữ thân |
| Chữ cái đầu của ô giữ chỗ | 700, khoảng 40% chiều cao ô. Ước lượng | SHOP-9 |

### Font

- **Be Vietnam Pro** 500, 600, 700, kiểu thường, qua `@fontsource/be-vietnam-pro` 5.3.0 (ghim đúng phiên bản trong `pnpm-lock.yaml`), giấy phép OFL-1.1. `design.md` ghi Urbanist, nhưng Urbanist không có subset `vietnamese` nên chữ có dấu thanh (ả, ổ, ữ…) rơi về font dự phòng ngay giữa từ; SPEC (Tech Stack) và plan (mục 14) chọn Be Vietnam Pro. Đã xem bằng chrome-devtools: "Trang chủ", "Sản phẩm", "Giới thiệu", "Đăng nhập", "Hệ thống" hiện đủ dấu bằng Be Vietnam Pro.
- `main.tsx` nhập `500.css`, `600.css`, `700.css` của gói. Mỗi file có ba `@font-face` cho subset `latin`, `latin-ext`, `vietnamese`, với `unicode-range` và `font-display: swap`; trình duyệt chỉ tải subset có ký tự trên trang, và chỉ tải `woff2`. Chín file `woff2` cộng lại khoảng 144 KB, dưới mức 150 KB của NFR5. Bản build có thêm chín file `woff` mà gói khai báo làm dự phòng; trình duyệt hiện nay không tải chúng.
- **Font dự phòng** `'Be Vietnam Pro Fallback'` ở cuối `tokens.css`: `local('Arial')`, `local('ArialMT')`, `local('Liberation Sans')`, với `size-adjust: 110.36%`, `ascent-override: 90.61%`, `descent-override: 24.01%`, `line-gap-override: 0%`. Đây là số `next/font` tính cho cùng font (capsize), nên `user` có cùng font dự phòng.

### Khoảng cách

| Token | Giá trị |
|---|---|
| `--space-1`, `--space-2`, `--space-2-5`, `--space-3`, `--space-3-5`, `--space-4`, `--space-4-5`, `--space-6`, `--space-7` | 4, 8, 10, 12, 14, 16, 18, 24, 28 px |
| `--gap` | 16 px, khoảng cách giữa các thẻ |
| `--gutter` | `clamp(16px, 1.6vw, 28px)`, lề ngang của `.shell` |
| `--app-max` | 1840 px, bề rộng tối đa của `.shell` |

Đo từ trang mẫu (theo `design.md`): đệm thẻ 18; nút 0 18 cao 42 và 0 14 cao 34; ô nhập 10 14 cao 44; ô bảng 10 12; nhãn cách ô 4.

### Bo góc, bóng, kính

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--r-card` | 26 px | Thẻ kính |
| `--r-tile` | 22 px | Ô màu, ô giữ chỗ ở thẻ và trang chi tiết |
| `--r-dialog` | 30 px | Hộp thoại |
| `--r-field` | 14 px | Ô nhập, banner, toast, khung xương mặc định |
| `--r-thumb` | 12 px | Ô giữ chỗ 40×40 ở dòng bảng. Ước lượng |
| `--r-ctl` | 999 px | Nút, viên thuốc, huy hiệu |
| `--card-shadow` | Tối: bảy lớp của trang mẫu (`inset 0 1px 1px #ffffff4d` … `0 24px 48px -22px #000000bf`). Sáng: `inset 0 1px 1px #ffffffcc, 0 1px 2px #0f17240f, 0 18px 40px -22px #0f172447` | Thẻ, viên thuốc, hộp thoại |
| `--button-shadow` | Tối: `inset 0 1px 0 #ffffff47, inset 0 -1px 0 #0000001f, 0 6px 16px -6px #7aaef0a6`. Sáng: `0 6px 16px -8px #2b63c499`. Ước lượng | Nút chính, nút nguy hiểm |
| `--blur`, `--sat` | 14 px, 175% | `backdrop-filter` của thẻ và viên thuốc |
| `--blur-thick` | 30 px | Màn che sau hộp thoại (SHOP-9) |

Không có `backdrop-filter`, hay `prefers-reduced-transparency: reduce`: `.card` và `.pill` dùng nền `--solid`. Không dùng bộ lọc SVG của trang mẫu.

### Chuyển động

| Token | Giá trị |
|---|---|
| `--ease` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--dur-fast`, `--dur`, `--dur-slow` | 150, 200, 250 ms. Ước lượng |

`prefers-reduced-motion: reduce` đặt ba thời lượng về 0 và tắt nhấp nháy của khung xương.

### Điểm ngắt

640, 768, 1024, 1440 px (`sm`, `md`, `lg`, `xl`). CSS variables không dùng được trong media query, nên viết số trực tiếp, như `@media (width < 768px)`. `admin` thiết kế cho từ 1024 px: dưới 1024 px bảng S1.6 cuộn ngang trong thẻ (`.table-wrap`), form S2 một cột dưới 640 px (SHOP-20). Dưới 768 px ô nhập dùng chữ 16 px, vì iOS phóng to trang khi ô nhập nhỏ hơn.

## Classes

| Class | Component của `design.md` | Ghi chú |
|---|---|---|
| `.btn .btn--primary` | Nút chính | Cao 42, đệm 0 18, nền `--accent`, `--button-shadow`; hover sáng hơn 6%; active lún 1 px; `:disabled` hay `aria-disabled="true"` mờ 50%. Không khóa nút trước khi gửi form |
| `.btn .btn--secondary` | Nút phụ | Nền `--surface-2`, viền `--line-2`; hover nền `--line-2` |
| `.btn .btn--danger` | Nút nguy hiểm | Nền `--destructive`. Chỉ cho nút Xóa của S3 |
| `.btn--sm` | Nút phụ 34 | Cao 34, đệm 0 14, chữ 12,5/18,1; ở danh sách, dòng bảng, phân trang |
| `.btn--bad-text` | Nút Xóa của dòng (S1.8) | Chữ `--bad-text`, dùng cùng `.btn--secondary.btn--sm` |
| `.badge .badge--info`, `--neutral`, `--good`, `--warn`, `--bad` | Huy hiệu trạng thái | Cao 24, đệm 4 10, chấm 6 px và chữ 12/600; luôn có chữ. Đang bán `info`, Ẩn `neutral`, Còn hàng `good`, Hết hàng `warn`, "-16%" `bad`. Kích thước ước lượng |
| `.card` | Thẻ kính | Nền `--surface`, blur, bo 26, đệm 18, `--card-shadow`, không viền |
| `.label`, `.label__required` | Nhãn trường | 14/500 trên ô; dấu `*` của trường bắt buộc đặt `aria-hidden="true"`, ô có `required` |
| `.input` | Ô nhập, vùng văn bản, ô chọn | Cao 44 (vùng văn bản tối thiểu 144, kéo giãn dọc), bo 14, đệm 10 14, nền `--surface-2`, viền `--control-border`. Focus: viền `--accent-line` và vầng 3 px. Lỗi: `aria-invalid="true"` thì viền `--bad-text`. Khóa: mờ 50% |
| `.field-hint`, `.field-error` | Gợi ý, dòng lỗi | 12,5/500; lỗi màu `--bad-text`, đặt biểu tượng trước chữ; gắn vào ô bằng `aria-describedby` |
| `.search`, `.search__icon`, `.search__input` | Ô tìm (S1.5) | Viên thuốc cao 44, kính lúp 16 px bên trái (`aria-hidden`), chữ cách trái 40 |
| `.table-wrap`, `.table`, `.table__num`, `.table__actions` | Bảng (S1.6) | Đặt trong `.card`. Tiêu đề cột 12/600 `--muted`, đệm 10 12; dòng cao 64, đệm 12, kẻ `--line`, hover `--surface-2`; cột giá và thao tác căn phải. `.table-wrap` cuộn ngang: cho nó `tabindex="0"` và nhãn |
| `.banner .banner--error`, `.banner--warn`, `.banner__icon` | Banner (S2.5, S2.7) | Bo 14, nền tint 14% hay 16%, biểu tượng màu bad hay warn, chữ `--text` 14/500. Lỗi `role="alert"`, cảnh báo `role="status"` |
| `.skeleton` | Khung xương | Nền `--surface-2`, nhấp nháy 1,2 s; đặt `border-radius` như phần tử thật; vùng chứa có `aria-busy="true"` |
| `.visually-hidden` | | Chữ chỉ cho trình đọc màn hình, như nhãn ẩn "Tìm theo tên" |
| `.shell`, `.shell__bar`, `.shell__main`, `.shell__status` | Khung trang | Rộng tối đa `--app-max`, lề `--gutter` |
| `.pill`, `.pill--brand`, `.pill__link`, `.pill__control`, `.pill__select` | Viên thuốc điều hướng (S1.1) | Thanh cao 49,6, bo 999, nền `--surface`; mục cao 39,6, đệm 10 16, chữ 13,5/600; mục đang chọn (`aria-current="page"` mà `NavLink` đặt, không có class riêng) và hover nền `--surface-2`. Ô chọn ngôn ngữ và giao diện có viền `--control-border` |

## App shell (S1.1)

`root-layout.tsx` dựng ba viên thuốc trong `<header>`:

1. Trái: tên app "tungph7 codebase", là liên kết về trang chủ, không phải h1. Mỗi trang có h1 duy nhất của nó.
2. Giữa: `<nav aria-label="Điều hướng chính">` (en "Main navigation") với Trang chủ, Sản phẩm, Giới thiệu; `NavLink` đặt `aria-current="page"` cho mục đang mở.
3. Phải: đổi ngôn ngữ, đổi giao diện (nhãn ẩn "Ngôn ngữ", "Giao diện"), Đăng nhập hay email khi đã đăng nhập.

Không có thanh công cụ dọc của ảnh mẫu. Nút "thanh bên" demo và `<aside>` của nó đã gỡ (plan, mục 14). `admin` chỉ có bố cục máy tính, từ 1024 px.

## Not Yet Built

Các component có hành vi của bảng Design System làm ở SHOP-9 (T2): Field, nút phân đoạn (SegmentedControl, kiểu lọc và kiểu chọn), phân trang (Pagination), hộp thoại (Dialog), toast, ô giữ chỗ (PlaceholderTile). SHOP-9 thêm chúng vào file này. Thẻ sản phẩm và hiển thị giá ở thẻ thuộc `user` (`docs/design-system/user.md`).
