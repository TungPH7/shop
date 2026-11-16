# Design system: admin

> **App:** `apps/admin` · **Nguồn:** bảng Design System của [docs/specs/SHOP-7/design.md](../specs/SHOP-7/design.md) · **Plan:** [docs/specs/SHOP-7/plan.md](../specs/SHOP-7/plan.md), Architecture Decisions mục 14 và 15 · **Cập nhật:** 2026-11-16, SHOP-8, SHOP-9, SHOP-19 và SHOP-20

Design system của `admin` là CSS variables và CSS thường, không có Tailwind hay thư viện UI (NFR13). Mỗi màn hình dùng token và class dưới đây, không tự đặt màu, cỡ chữ hay khoảng cách.

## Files

| File | Nội dung |
|---|---|
| `apps/admin/src/styles/tokens.css` | Mọi token: màu, chữ, khoảng cách, bo góc, bóng, kính, chuyển động; font dự phòng |
| `apps/admin/src/styles/global.css` | Nền trang, chữ thân, h1–h3, liên kết, vòng focus |
| `apps/admin/src/styles/components.css` | Class dùng chung: nút, huy hiệu, thẻ kính, ô nhập, bảng, banner, khung xương, khung trang |
| `apps/admin/src/styles/list-page.css` | Class riêng của trang danh sách sản phẩm (S1): ô, dòng thông báo và khung xương của bảng sản phẩm, hàng tiêu đề, hàng bộ lọc, thẻ của bảng. Tách khỏi `components.css` ở SHOP-52 |
| `apps/admin/public/theme-init.js` | Script thường, chặn render, trong `<head>` của `index.html`: đặt giao diện đã lưu lên `<html>` trước khung hình đầu tiên |
| `apps/admin/src/main.tsx` | Nạp font, rồi `tokens.css`, `global.css`, `components.css`, `list-page.css` theo thứ tự đó (`list-page.css` dựa trên `.table`, `.card`, `.skeleton` của `components.css`); cho `<html>` theo mọi lần đổi giao diện của store |
| `apps/admin/src/stores/theme/apply-theme.ts` | `applyTheme`, `syncThemeToDocument`: đặt hay gỡ `data-theme` trên `<html>` theo store |
| `apps/admin/src/components/theme/theme-switcher.tsx` | Ô chọn Sáng, Tối, Hệ thống ở khung trang |
| `apps/admin/src/app/layouts/root-layout.tsx` | Khung trang S1.1 |
| `apps/admin/src/components/ui/field.tsx` | `InputField`, `TextAreaField`, `SelectField` (mục Components) |
| `apps/admin/src/components/ui/segmented-control.tsx` | `SegmentedFilter`, `SegmentedChoice` |
| `apps/admin/src/components/ui/pagination.tsx` | `Pagination` |
| `apps/admin/src/components/ui/dialog.tsx` | `Dialog` |
| `apps/admin/src/components/ui/placeholder-tile.tsx` | `PlaceholderTile` |
| `apps/admin/src/components/feedback/notifications.tsx` | Toast: vẽ store thông báo |
| `apps/admin/src/lib/notifications/notification-store.ts` | Store thông báo: `notify.success`, `notify.error`, `notify.info`; đếm 6 s, `pauseTimers`, `resumeTimers` |
| `apps/admin/src/lib/i18n/locales/{vi,en}/common.json` | Chữ của component: `pagination.*`, `dialog.close`, `notifications.*` |

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
| `--dialog` | #fffffff0 | #1c1c20db | Hộp thoại và toast |
| `--scrim` | #0f172466 | #00000099 | Màn che sau hộp thoại, đi cùng `--blur-thick`. SHOP-9 thêm: `design.md` chỉ ghi "tối đi và mờ" |
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
| `--group-<tên>-from`, `-to`, `-text` | blue #354a6a → #283953, #eef4fd; coral #6a423d → #52322e, #fdeeeb; green #375741 → #29432f, #eef9f1; orange #66503a → #4e3d2b, #fdf3e6; teal #31574f → #24433d, #ecf8f5; ink #3b3e46 → #2c2e34, #f1f2f5 | giống bên trái | Ô giữ chỗ của sản phẩm (gradient 160°), `.tile` |

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
| Chữ cái đầu của ô giữ chỗ | 700, 40% chiều cao ô (16 px ở ô 40). Ước lượng | `.tile` |

### Font

- **Be Vietnam Pro** 500, 600, 700, kiểu thường, qua `@fontsource/be-vietnam-pro` 5.3.0 (ghim đúng phiên bản trong `pnpm-lock.yaml`), giấy phép OFL-1.1. `design.md` ghi Urbanist, nhưng Urbanist không có subset `vietnamese` nên chữ có dấu thanh (ả, ổ, ữ…) rơi về font dự phòng ngay giữa từ; SPEC (Tech Stack) và plan (mục 14) chọn Be Vietnam Pro. Đã xem bằng chrome-devtools: "Trang chủ", "Sản phẩm", "Giới thiệu", "Đăng nhập", "Hệ thống" hiện đủ dấu bằng Be Vietnam Pro.
- `main.tsx` nhập `500.css`, `600.css`, `700.css` của gói. Mỗi file có ba `@font-face` cho subset `latin`, `latin-ext`, `vietnamese`, với `unicode-range` và `font-display: swap`; trình duyệt chỉ tải subset có ký tự trên trang, và chỉ tải `woff2`. Chín file `woff2` cộng lại khoảng 144 KB, dưới mức 150 KB của NFR5. Bản build có thêm chín file `woff` mà gói khai báo làm dự phòng; trình duyệt hiện nay không tải chúng.
- **Font dự phòng** `'Be Vietnam Pro Fallback'` ở cuối `tokens.css`: `local('Arial')`, `local('ArialMT')`, `local('Liberation Sans')`, với `size-adjust: 110.36%`, `ascent-override: 90.61%`, `descent-override: 24.01%`, `line-gap-override: 0%`. Đây là số `next/font` tính cho cùng font (capsize), nên `user` có cùng font dự phòng.

### Khoảng cách

| Token | Giá trị |
|---|---|
| `--space-1`, `--space-2`, `--space-2-5`, `--space-3`, `--space-3-5`, `--space-4`, `--space-4-5`, `--space-6`, `--space-7` | 4, 8, 10, 12, 14, 16, 18, 24, 28 px |
| `--space-5-5` | 22 px, đệm của hộp thoại (SHOP-9, theo `design.md`) |
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
| `--blur-thick` | 30 px | Màn che sau hộp thoại (`.dialog::backdrop`) |
| `--tile-thumb` | 40 px | Ô giữ chỗ ở dòng bảng S1.6 (SHOP-9) |
| `--icon-btn` | 40 px | Nút tròn chỉ có biểu tượng: nút Đóng của hộp thoại S3.2 (SHOP-9) |
| `--search-width` | 320 px | Bề rộng ô tìm S1.5 ở bên phải hàng bộ lọc (SHOP-19). `design.md` không ghi số; ảnh S1 không có ô tìm, nên đây là đề xuất của `fe-dev` |

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
| `.table__product`, `.table__product-text`, `.table__name`, `.table__sub` | Ô Sản phẩm của bảng (S1.6) | Ô giữ chỗ 40, cách 12, rồi tên 14/600 `--text` và slug 12,5 `--hint` bên dưới (SHOP-19); ở `list-page.css` |
| `.table__message` | Dòng thông báo thay thân bảng (S1.9, S1.10, lỗi của S1.6) | Một ô trải hết các cột, căn giữa, đệm 28 12; chữ `--muted`, nút hay liên kết bên dưới (SHOP-19); ở `list-page.css` |
| `.table__skeleton-tile`, `.table__skeleton-text`, `.table__skeleton-cell` | Khung xương của bảng (S1.6) | Đi cùng `.skeleton`: ô 40 bo `--r-thumb`, dòng chữ, ô 60% (SHOP-19); ở `list-page.css` |
| `.page-header` | Hàng tiêu đề của trang danh sách (S1.2, S1.3) | h1 bên trái, nút chính bên phải, cách bảng lọc 24 (SHOP-19); ở `list-page.css` |
| `.toolbar`, `.toolbar__group`, `.toolbar__count` | Hàng bộ lọc (S1.4, S1.5) | Nút phân đoạn và nhãn đếm 12,5/600 `--muted` bên trái, ô tìm rộng `--search-width` bên phải; xuống dòng khi hẹp (SHOP-19); ở `list-page.css` |
| `.list-page__card` | Thẻ của bảng (S1.6, S1.11) | `.card` chứa bảng; phân trang bên dưới, cách một đường kẻ `--line` (SHOP-19); ở `list-page.css` |
| `.banner .banner--error`, `.banner--warn`, `.banner__icon` | Banner (S2.5, S2.7) | Bo 14, nền tint 14% hay 16%, biểu tượng màu bad hay warn, chữ `--text` 14/500. Lỗi `role="alert"`, cảnh báo `role="status"`. Chữ là một `<p>`, không có lề |
| `.form-page`, `.form-page__back` | Trang form (S2.2, S2.4) | Cột rộng tối đa 640 px, căn giữa; liên kết "← Sản phẩm" 13,5/600 `--accent-text` cách thẻ 16, mũi tên `aria-hidden` (SHOP-20) |
| `.product-form`, `.product-form__header`, `.product-form__subtitle`, `.product-form__pair`, `.product-form__actions` | Khung form (S2.3, S2.4, S2.13, S2.14) | Đặt cùng `.card`. Các khối cách nhau `--gap` 16; tiêu đề h1 và dòng phụ `--muted` ở đầu thẻ, như ảnh 02; giá bán và giá gốc, rồi Trạng thái và Tình trạng, mỗi cặp hai cột bằng nhau, một cột dưới 640 px; nút Hủy và nút Lưu căn phải ở cuối thẻ (SHOP-20) |
| `.skeleton` | Khung xương | Nền `--surface-2`, nhấp nháy 1,2 s; đặt `border-radius` như phần tử thật; vùng chứa có `aria-busy="true"` |
| `.visually-hidden` | | Chữ chỉ cho trình đọc màn hình, như nhãn ẩn "Tìm theo tên" |
| `.shell`, `.shell__bar`, `.shell__main`, `.shell__status` | Khung trang | Rộng tối đa `--app-max`, lề `--gutter` |
| `.field`, `.field__meta`, `.field__messages`, `.field-warning`, `.field-counter`, `.field-icon` | Trường của form | Do `InputField`, `TextAreaField`, `SelectField` vẽ. Dòng cảnh báo màu `--warn-text` kèm biểu tượng; bộ đếm `--hint`, thành `--bad-text` khi vượt (`data-over`) |
| `.input-group`, `.input-group__input`, `.input-group__affix` | Ô nhập có phần đầu hay hậu tố | Khung là `.input`; focus và lỗi vẽ trên khung (`:focus-within`, `:has([aria-invalid])`) |
| `.segmented`, `.segmented__item`, `.segmented__radio`, `.choice` | Nút phân đoạn | Nhóm nền `--surface-2`, bo 999, rộng vừa các mục; mục cao 34, đệm 8 14, chữ 12,5/600 `--muted`; mục đang chọn (`aria-pressed`, hay radio `:checked`) nền `--line-2`, chữ `--text` |
| `.pagination`, `.pagination__summary`, `.pagination__list`, `.pagination__page`, `.pagination__gap` | Phân trang (S1.11) | Mục là liên kết mang class `.btn--secondary.btn--sm`; trang hiện tại (`aria-current`) nền `--line-2`, viền `--control-border` |
| `.dialog`, `.dialog__header`, `.dialog__title`, `.dialog__close`, `.dialog__body`, `.dialog__error`, `.dialog__actions` | Hộp thoại (S3) | Nền `--dialog` kính, bo 30, rộng `min(92vw, 560px)`, đệm 22; màn che `--scrim` và blur 30; nút Đóng tròn 40; lỗi là `.banner--error` |
| `.toasts`, `.toast`, `.toast__icon`, `.toast__message`, `.toast__close` | Toast (S1.12) | Đáy giữa, rộng `min(92vw, 480px)`; nền `--dialog`, bo 14, đệm 12 16, `--card-shadow`; biểu tượng màu theo `data-kind`; nút đóng tròn 34 |
| `.tile` | Ô giữ chỗ | 40×40, bo `--r-thumb`, gradient 160° theo `data-group` |
| `.pill`, `.pill--brand`, `.pill__link`, `.pill__control`, `.pill__select` | Viên thuốc điều hướng (S1.1) | Thanh cao 49,6, bo 999, nền `--surface`; mục cao 39,6, đệm 10 16, chữ 13,5/600; mục đang chọn (`aria-current="page"` mà `NavLink` đặt, không có class riêng) và hover nền `--surface-2`. Ô chọn ngôn ngữ và giao diện có viền `--control-border` |

## App shell (S1.1)

`root-layout.tsx` dựng ba viên thuốc trong `<header>`:

1. Trái: tên app "tungph7 codebase", là liên kết về trang chủ, không phải h1. Mỗi trang có h1 duy nhất của nó.
2. Giữa: `<nav aria-label="Điều hướng chính">` (en "Main navigation") với Trang chủ, Sản phẩm, Giới thiệu; `NavLink` đặt `aria-current="page"` cho mục đang mở.
3. Phải: đổi ngôn ngữ, đổi giao diện (nhãn ẩn "Ngôn ngữ", "Giao diện"), Đăng nhập hay email khi đã đăng nhập.

Không có thanh công cụ dọc của ảnh mẫu. Nút "thanh bên" demo và `<aside>` của nó đã gỡ (plan, mục 14). `admin` chỉ có bố cục máy tính, từ 1024 px.

## Components

Component có hành vi của SHOP-9, trong `apps/admin/src/components/`. Mỗi component có file test cạnh nó, cho từng trạng thái. Props mô tả ý định (`label`, `error`, `isBusy`), không mô tả cách vẽ, và không nhận `className` (UI-008).

### Field (`ui/field.tsx`)

`InputField`, `TextAreaField`, `SelectField`: nhãn trên ô, rồi lỗi, cảnh báo, gợi ý và bộ đếm.

| Prop | Ý nghĩa |
|---|---|
| `label` | Nhãn, gắn với ô bằng `htmlFor`. Trường tùy chọn ghi "(không bắt buộc)" ngay trong nhãn |
| `required` | Đặt `required` cho ô và hiện `*` (`aria-hidden`) |
| `hint`, `error`, `warning` | Gợi ý; lỗi (đặt `aria-invalid`, viền `--bad-text`); cảnh báo không chặn, như đổi slug (S2.7) |
| `counter` | `{ count, max }`, hiện "n/max". Form tính `count` (độ dài UTF-16, như `api`), vì ô có thể không được điều khiển |
| `prefix`, `suffix` | Chỉ `InputField`: chữ cố định trước hay sau giá trị, như "/products/" (S2.7) và "₫" (S2.9). `aria-hidden`, vì nhãn đã nói điều đó |

- Mọi prop khác của phần tử gốc đi thẳng vào ô, kể cả `ref`, nên form trải `register()` của react-hook-form: `<InputField label="Tên sản phẩm" {...register('name')} />`. Không có `id` thì component tự sinh.
- `aria-describedby` của ô theo thứ tự đọc: lỗi, cảnh báo, gợi ý, bộ đếm, rồi các id do nơi gọi thêm.
- Lỗi không có role sống: khi lưu lỗi, form đưa focus về ô sai đầu tiên (S2.6), và ô đọc mô tả của nó, lỗi trước. Cảnh báo nằm trong một vùng `role="status"` luôn có sẵn, rỗng khi không có cảnh báo, để cảnh báo xuất hiện sau được đọc.

### SegmentedControl (`ui/segmented-control.tsx`)

Một kiểu vẽ, hai hành vi. Cả hai được điều khiển: nơi gọi giữ `value` (URL, hay `Controller` của react-hook-form) và nhận `onChange(value)`.

- `SegmentedFilter` (S1.4): `role="group"` có `label`, mỗi mục là `<button aria-pressed>` và là một điểm Tab. Bấm mục đang chọn không gọi `onChange`.
- `SegmentedChoice` (S2.11, S2.12): `<fieldset>` với `<legend>`, mỗi mục là radio gốc ẩn bằng mắt, nên cả nhóm là một điểm Tab và mũi tên đổi lựa chọn. `hint` mô tả nhóm (`aria-describedby` trên `<fieldset>`). Tên radio tự sinh, nên hai nhóm trên cùng form không lẫn nhau.

### Pagination (`ui/pagination.tsx`)

`<Pagination page pageSize totalItems hrefFor />` (S1.11).

- Đổi trang là điều hướng (UI-001): mỗi mục là một liên kết `<a href>` tới URL của trang đó, do nơi gọi dựng bằng `hrefFor(page)` và giữ các tham số khác của danh sách (`?q=…&status=…&page=3`). Nên một trang mở được ở tab mới hay chép được link (AC4). Bấm thì đi qua router, không tải lại trang. URL là nguồn sự thật: nơi gọi đọc lại `page` từ `?page=`, component không có `onPageChange`.

- `<nav>` có nhãn "Phân trang", dòng "Hiển thị 1–20 trên 25" với số theo ngôn ngữ (`10.000` ở `vi`), Trước, số trang, Sau. Ẩn khi chỉ có một trang.
- Trang hiện tại có `aria-current="page"`; liên kết số trang có nhãn "Trang n".
- Trước ở trang đầu và Sau ở trang cuối là liên kết bị khóa: `<a>` không có `href`, với `role="link"`, `aria-disabled="true"` và `tabIndex={0}`. Vẫn là cùng một phần tử `<a>` với liên kết đang dùng được, nên người dùng bàn phím đi tới trang cuối bằng Sau vẫn giữ focus trên Sau.
- Tới 7 trang thì hiện đủ. Dài hơn: trang đầu, trang cuối, và một trang mỗi bên trang hiện tại; dấu "…" (`aria-hidden`) không bao giờ thay cho đúng một trang.
- Nơi gọi đọc `?page=` một lần và truyền một trang hợp lệ: `page` không hợp lệ thì dùng trang 1 (S1.11), để dòng "Hiển thị…" khớp với các dòng của bảng. Component cũng chốt chặn theo đúng luật đó: trang vượt quá trang cuối, `NaN`, `0` hay `2.5` hiện như trang 1.

### Dialog (`ui/dialog.tsx`)

`<Dialog open title cancelLabel onCancel action isBusy error>nội dung</Dialog>` (S3).

- `<dialog>` gốc mở bằng `showModal()`: phần phía sau inert. `role="alertdialog"`, `aria-modal`, tên là `title` (h2), mô tả là nội dung.
- Focus đầu ở nút Hủy. Tab và Shift+Tab xoay vòng trong hộp thoại (một `<dialog>` trần để focus ra thanh của trình duyệt).
- Esc (sự kiện `cancel`), nút Hủy và nút Đóng tròn đều gọi `onCancel`; nơi gọi đóng bằng `open={false}`. Trình duyệt tự đóng thì cũng coi như Hủy.
- Đóng: focus về phần tử có focus lúc mở (nút S1.8 của dòng). Nếu phần tử đó không còn, như dòng của sản phẩm vừa xóa, nơi gọi chuyển focus.
- `action` là nút làm việc đó, như nút Xóa `.btn--danger` của S3. `isBusy`: Hủy, Đóng và Esc không làm gì, và hai nút khóa bằng `aria-disabled` để focus không rơi khỏi hộp thoại; nơi gọi khóa `action` cùng cách và đổi chữ ("Đang xóa…"). `error` hiện trên hàng nút, `role="alert"`.
- Toast mở lúc hộp thoại đang mở nằm dưới màn che, vì hộp thoại ở top layer; lỗi của S3 vì vậy hiện trong hộp thoại.

### Toast (`feedback/notifications.tsx`)

Gọi `notify.success('Đã xóa sản phẩm')` (hay `error`, `info`) từ bất cứ đâu; `<Notifications>` ở `app/provider.tsx` vẽ chúng (S1.12).

- Xếp chồng ở đáy giữa màn hình. Mỗi toast có biểu tượng theo loại, chữ và nút đóng ("Đóng thông báo"). Đóng bằng bàn phím (Enter, Space) thì focus sang nút đóng của toast kế tiếp, hay của toast trước nếu đó là toast cuối, hay về phần tử có focus trước khi vào vùng toast nếu không còn toast nào; không rơi về `<body>` (WCAG 2.4.3). Đóng bằng chuột thì không dời focus, để bộ đếm chạy lại.
- Mỗi toast ở lại 6 s, mọi loại như nhau. Rê chuột lên các toast hay đưa focus vào chúng thì mọi bộ đếm dừng, và chạy tiếp phần còn lại khi rời đi (`pauseTimers`, `resumeTimers` của store). Toast thêm lúc đang dừng chỉ bắt đầu đếm khi chạy tiếp. Đóng một toast thì bộ đếm chạy lại tới lần rê chuột kế tiếp: các toast còn lại tụt xuống, và trình duyệt có thể không báo con trỏ đã rời đi.
- Vùng `<section aria-label="Thông báo" aria-live="polite">` luôn có, kể cả khi rỗng. Lỗi là `role="alert"`, thành công và thông tin là `role="status"`.
- `useTranslation` của nó không suspend, vì nó nằm ngoài mọi `<Suspense>`.

### PlaceholderTile (`ui/placeholder-tile.tsx`)

`<PlaceholderTile id name />`: ô 40×40 của dòng bảng S1.6, `aria-hidden`, vì tên sản phẩm luôn ở cạnh nó.

- Màu nhóm: `GROUPS[parseInt(id.slice(-8), 16) % 6]`, `GROUPS = [blue, coral, green, orange, teal, ink]` (plan, Architecture Decisions mục 15). 8 ký tự hex cuối của UUIDv7 là phần ngẫu nhiên, và `id` không đổi, nên đổi tên hay slug không đổi màu. `id` không phải hex thì dùng `blue`.
- Chữ: ký tự đầu của tên sau khi bỏ khoảng trắng đầu, qua `toLocaleUpperCase('vi')`. "Ký tự" là một grapheme (`Intl.Segmenter`), nên chữ có dấu viết ở dạng tách (NFD), như "a" cộng dấu hỏi, vẫn ra "Ả". Tên rỗng thì ô không có chữ.
- `user` (SHOP-10) dùng cùng thuật toán, để một sản phẩm có cùng màu ở hai app.

## Not Yet Built

Không còn component nào của bảng Design System cho `admin`. Thẻ sản phẩm và hiển thị giá ở thẻ thuộc `user` (`docs/design-system/user.md`).
