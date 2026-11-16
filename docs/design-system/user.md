# Design system: user

> **App:** `apps/user` · **Nguồn:** bảng Design System của [docs/specs/SHOP-7/design.md](../specs/SHOP-7/design.md) · **Plan:** [docs/specs/SHOP-7/plan.md](../specs/SHOP-7/plan.md), Architecture Decisions mục 14 và 15 · **Cập nhật:** 2026-11-16, SHOP-23

Design system của `user` là CSS variables và CSS thường, không có Tailwind hay thư viện UI (NFR13). Mỗi màn hình chỉ dùng token semantic và class dưới đây, không tự đặt màu, cỡ chữ hay khoảng cách (quy ước `apps/user/docs/coding-conventions/v1/12-styling-theming-a11y.md`). Khung trang (thanh điều hướng S4.1, chân trang S4.11) làm ở SHOP-11, mục Page Frame.

## Files

| File | Nội dung |
|---|---|
| `apps/user/src/styles/tokens.css` | Mọi token: tầng primitive (bảng màu OKLCH), tầng semantic sáng (`:root`) và tối (`.dark`), chữ, khoảng cách, bo góc, bóng, kính, chuyển động |
| `apps/user/src/styles/tokens.test.ts` | Ghim từng vai trò màu vào hex của `design.md` ở hai giao diện, và kiểm các cặp tương phản WCAG AA |
| `apps/user/src/styles/components.css` | Class dùng chung: nút, huy hiệu, thẻ kính, ô "well", ô nhập, ô chọn, ô tìm, khung xương, ô giữ chỗ; khung trang (SHOP-11) |
| `apps/user/src/app/globals.css` | Reset, nền trang, chữ thân, h1, h2, liên kết, vòng focus |
| `apps/user/src/config/fonts.ts` | Be Vietnam Pro qua `next/font/google` |
| `apps/user/src/components/ui/placeholder-tile.tsx` | `PlaceholderTile`, `placeholderGroup`, `placeholderInitial` |
| `apps/user/src/components/ui/icons.tsx` | Biểu tượng 16 px nét `currentColor`, `aria-hidden`: mặt trời, mặt trăng, màn hình, người, đăng xuất (SHOP-11). Không có thư viện biểu tượng |
| `apps/user/src/features/site/components/site-nav.tsx`, `site-footer.tsx`, `model/nav.ts` | Thanh điều hướng S4.1, chân trang S4.11, ba mục điều hướng và quy tắc mục đang chọn (SHOP-11) |
| `apps/user/src/app/[locale]/layout.tsx` | Nạp `tokens.css`, `components.css`, `globals.css` theo thứ tự đó; gắn `--font-sans` vào `<html>`; ghép khung `.site-shell`: `SiteNav` (nhận `AuthStatus` trong `Suspense` qua prop `account`), trang, `SiteFooter` |
| `apps/user/src/app/global-error.tsx` | Gốc `<html>` thay layout khi layout lỗi: nạp cùng ba file, cùng thứ tự, và gắn `--font-sans`, vì khi đó Next chỉ gửi CSS mà file này nạp. `--font` có dự phòng `system-ui` nếu thiếu `--font-sans` |

`components.css` được nạp từ layout, không bằng `@import` trong `globals.css`: với `@import`, Turbopack ở chế độ dev tách file ra một chunk riêng và preload nó mà không dùng, nên console có cảnh báo.

## Theme

- Mặc định theo giao diện của hệ thống. `next-themes` (`src/components/theme-provider.tsx`) đặt class `.dark` lên `<html>` khi giao diện là tối, và tự đặt `color-scheme`; `tokens.css` không khai `color-scheme`.
- Ba nút Sáng, Tối, Hệ thống của `ThemeSwitcher` nằm trong viên tiện ích của thanh điều hướng (SHOP-11): từ 1024 px là chữ, dưới 1024 px là biểu tượng, chữ vẫn là tên của nút.
- Chỉ tầng semantic đổi theo giao diện. `tokens.test.ts` kiểm khối `.dark` không khai lại token nào của bảng màu primitive.

## Tokens

Mọi dòng của bảng Design System là "mới". Mọi dòng `user` dùng đều có ở đây: token ở mục này, class ở mục Classes, và hai component chưa có class (viên thuốc điều hướng, thẻ sản phẩm) ở mục Components Built Later, với giá trị của `design.md` và item sẽ làm chúng. Dòng không có ở đây là dòng chỉ `admin` dùng (nút nguy hiểm, hộp thoại, toast, banner, bảng, phân trang, nút phân đoạn).

### Màu

`user` giữ tên các vai trò semantic đã có (cột Token) và đổi giá trị theo bảng; vai trò mới của `design.md` có tên mới cùng tầng. Cột "Tên trong design.md" là tên `admin` dùng (`apps/admin/src/styles/tokens.css` của SHOP-8).

| Token | Tên trong design.md | Sáng | Tối | Dùng cho |
|---|---|---|---|---|
| `--background` | bg | #f2f4f8 | #111113 | Nền `<html>` và màu nền của `<body>` |
| `--background-from`, `--background-to` | bg (gradient) | #eef1f6 → #f6f8fb | #0c0c0e → #131316 | Gradient 135° của `<body>` |
| `--foreground`, `--surface-foreground`, `--secondary-foreground` | text | #0f1724 | #f6f8fc | Chữ chính, nhãn trường, chữ trên thẻ và nút phụ |
| `--surface` | surface | #ffffffb8 | #1e1e226b | Thẻ kính; đi cùng `--blur`, `--sat` |
| `--solid` | solid | #ffffff | #1d1d21 | Thay `--surface` khi không có `backdrop-filter` hay khi bật giảm độ trong suốt; nền `<option>` |
| `--dialog` | dialog | #fffffff0 | #1c1c20db | Nền hộp thoại và toast, nếu `user` cần |
| `--muted`, `--secondary` | surface-2 | #0f17240d | #ffffff14 | Nền ô nhập, nút phụ, khung xương, huy hiệu Ẩn |
| `--muted-foreground` | muted | #3b475a | #c9d1de | Chữ phụ, chữ huy hiệu Ẩn |
| `--hint` | hint | #556074 | #9aa1ad | Gợi ý, placeholder, giá gốc, dòng tiến độ, chân trang |
| `--border` | line | #0f17241a | #ffffff1a | Đường kẻ |
| `--border-strong` | line-2 | #0f17242e | #ffffff2e | Viền nút phụ; nền hover của nút phụ |
| `--control-border` | control-border | #667184 | #7d8696 | Viền ô nhập, ô chọn, ô tìm; từ 3:1 so với nền ô (WCAG 1.4.11) |
| `--well` | well | #0f17240d | #c8c8d71a | Ô "well" chứa giá ở S5 |
| `--ring` | accent-line | #2a5db8 | #8dbcf6 | Vòng focus 2 px cách 2 px; viền ô đang focus |
| `--focus-halo` | accent 18% | #2b63c4 ở 18% | #7aaef0 ở 18% | Vầng 3 px quanh ô đang focus |
| `--primary` | accent | #2b63c4 | #7aaef0 | Nền nút chính |
| `--primary-hover` | | `--primary` pha 6% trắng | như bên trái | Nền nút chính khi hover ("sáng hơn 6%") |
| `--primary-foreground` | on-accent | #ffffff | #071a33 | Chữ trên `--primary` |
| `--primary-text` | accent-text | #1a56b0 | #a9cdfc | Liên kết, chữ nhấn |
| `--success`, `--success-text`, `--success-tint` | good fill, good, fill 14%/16% | #2f9e5b, #166534, fill ở 14% | #5fc483, #8fdca8, fill ở 16% | Huy hiệu Còn hàng |
| `--warning`, `--warning-text`, `--warning-tint` | warn fill, warn | #c98a08, #8a5300 | #e4b759, #f3cd7e | Huy hiệu Hết hàng |
| `--info`, `--info-text`, `--info-tint` | info fill, info | #2b63c4, #1a56b0 | #7aaef0, #a9cdfc | Huy hiệu Đang bán |
| `--danger`, `--danger-text`, `--danger-tint` | bad fill, bad | #d4493c, #b42318 | #e98278, #f6a59c | Lỗi ô nhập, huy hiệu "-16%" |
| `--group-<tên>-from`, `-to`, `-text` | Màu nhóm (6) | blue #354a6a → #283953, #eef4fd; coral #6a423d → #52322e, #fdeeeb; green #375741 → #29432f, #eef9f1; orange #66503a → #4e3d2b, #fdf3e6; teal #31574f → #24433d, #ecf8f5; ink #3b3e46 → #2c2e34, #f1f2f5 | giống bên trái | Ô giữ chỗ (gradient 160°) |

Với bốn trạng thái, tên vai trò (`--success`) là màu fill cho chấm, `-text` là màu chữ (trên nền trang hay trên tint, như `--primary-text`), `-tint` là nền huy hiệu. Hậu tố `-foreground` chỉ dùng cho chữ đặt trên chính màu fill, như `--primary-foreground` trên `--primary`; không trạng thái nào có chữ trên fill, nên không có `--danger-foreground`. `tokens.test.ts` kiểm không trạng thái nào có `-foreground`, và kiểm `components.css`, `globals.css` chỉ đọc token đã khai. `--danger` của `user` vì vậy là fill của bad, không phải nút nguy hiểm: `user` không có nút nguy hiểm.

Một ngoại lệ của quy tắc hậu tố: `--muted-foreground` giữ tên cũ của `user` (Task giữ tên các vai trò đã có), nhưng là chữ phụ ở mọi nền, không chỉ trên `--muted`: nền trang, thẻ, ô nhập và huy hiệu Ẩn. `tokens.test.ts` kiểm tương phản của nó trên `--background` và `--surface`.

Giá trị viết bằng OKLCH ở tầng primitive (`--slate-950`, `--blue-600`, `--white-a8`…), mỗi dòng kèm hex gốc trong chú thích. Hai token bóng giữ hex của `design.md`.

**Tương phản.** `tokens.test.ts` đổi từng giá trị OKLCH về sRGB, chồng lớp trong suốt lên `--background`, và kiểm ở cả hai giao diện: chữ (`--foreground`, `--muted-foreground`, `--hint`, `--primary-text`, chữ của bốn trạng thái, chữ trên `--primary`, chữ trên sáu màu nhóm) từ 4,5:1; `--control-border` và `--ring` từ 3:1. Trên trình duyệt: axe 4.12.1 (WCAG 2.0, 2.1 A và AA) không báo vi phạm ở trang chủ và trang Giới thiệu, sáng và tối (`apps/user/e2e/accessibility.spec.ts`); Lighthouse cho 100 điểm Accessibility ở trang mẫu mọi class, sáng và tối.

### Chữ

| Token | Giá trị | Ghi chú |
|---|---|---|
| `--font` | `var(--font-sans, system-ui), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` | `--font-sans` là `"Be Vietnam Pro", "Be Vietnam Pro Fallback"` do `next/font` đặt |
| `--fs-2xs` … `--fs-display` | 11, 12, 12,5, 13,5, 14, 15, 17, 20, 22, 26, 34 px (`2xs`, `xs`, `sm`, `md`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `display`), viết bằng rem | |
| `--fs-title`, `--fs-title-sm` | 38 px, 28 px | Tiêu đề trang, đã đo |
| `--lh-base`, `--lh-tight` | 1,45 (14/20,3), 1,04 | Chữ thân; tiêu đề trang |
| `--fw-regular`, `--fw-semibold`, `--fw-bold` | 500, 600, 700 | Chỉ ba độ đậm có file font |

| Vai trò | Giá trị | Ở đâu |
|---|---|---|
| Chữ thân, nhãn trường | 14/20,3, 500 | `body`, `.label` |
| Tiêu đề trang (h1) | 38/39,5, 600, letter-spacing -0,025em; 28 dưới 768 px. **Đã đo** (xem Số đo) | `globals.css` `h1` |
| Tiêu đề mục và hộp thoại (h2) | 20/29, 700, letter-spacing -0,3 px | `globals.css` `h2` |
| Nút chính, nút hộp thoại | 13,5/19,6, 600 | `.btn` |
| Nút phụ nhỏ | 12,5/18,1, 600 | `.btn--sm` |
| Huy hiệu | 12/17,4, 600. **Đã đo** | `.badge` |
| Giá | Thẻ 17/700; chi tiết 34/700 (26 ở điện thoại); giá gốc 13,5/500 `--hint` gạch ngang | Dùng token `--fs-xl`, `--fs-display`, `--fs-4xl`, `--fs-md`; chi tiết ở `.product-price` (SHOP-23), thẻ ở Story của S4 |
| Chữ cái đầu của ô giữ chỗ | 700, 40% chiều cao ô | `.tile__initial` |

### Font

- **Be Vietnam Pro** 500, 600, 700, kiểu thường, qua `next/font/google` của Next 16.4.6 (`src/config/fonts.ts`), giấy phép OFL-1.1. `design.md` ghi Urbanist, nhưng Urbanist không có subset `vietnamese`, nên chữ có dấu thanh (ả, ổ, ữ…) rơi về font dự phòng ngay giữa từ; SPEC (Tech Stack) và plan (mục 14) chọn Be Vietnam Pro. Đã xem bằng chrome-devtools: "Giới thiệu", "Về trang chủ", "Nền tảng", "Ngôn ngữ hiện tại", "Hệ thống" hiện đủ dấu bằng Be Vietnam Pro, ở ba độ đậm.
- `next/font` tải font lúc build và phục vụ từ chính origin của app, nên CSP giữ `font-src 'self'` và trình duyệt không gọi Google (NFR13; `src/config/security-headers.test.ts`). Không thêm dependency nào.
- Ba subset `latin`, `latin-ext`, `vietnamese`, mỗi subset một file woff2 có `unicode-range`, `font-display: swap`. Chín file cộng lại khoảng 77 KB (7–14 KB mỗi file), dưới mức 150 KB một trang của NFR5; `next/font` preload cả chín. `apps/user/e2e/design-system.spec.ts` kiểm font đến từ origin của app, là woff2, và tổng không quá 150 KB.
- **Font dự phòng** `'Be Vietnam Pro Fallback'` do `next/font` sinh (`adjustFontFallback`): `local(Arial)`, `size-adjust: 110.36%`, `ascent-override: 90.61%`, `descent-override: 24.01%`, `line-gap-override: 0%`; cùng số với font dự phòng của `admin`. Không truyền tùy chọn `fallback` cho `next/font`: có nó, Turbopack bỏ font dự phòng chỉnh cỡ. Font hệ thống nằm sau `--font-sans` trong `--font`.

### Khoảng cách

| Token | Giá trị |
|---|---|
| `--space-1`, `--space-2`, `--space-2-5`, `--space-3`, `--space-3-5`, `--space-4`, `--space-4-5`, `--space-6`, `--space-7` | 4, 8, 10, 12, 14, 16, 18, 24, 28 px, viết bằng rem |
| `--gap` | 16 px, khoảng cách giữa các thẻ |
| `--gutter` | `clamp(16px, 1.6vw, 28px)`, lề ngang của khung trang (SHOP-11) |
| `--app-max` | 1840 px, bề rộng tối đa của khung trang (SHOP-11) |

Đo từ trang mẫu (theo `design.md`): đệm thẻ 18; nút 0 18 cao 42 và 0 14 cao 34; ô nhập 10 14 cao 44; nhãn cách ô 4. Ô "well": đệm 12 14 (đã đo).

### Bo góc, bóng, kính

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--r-card` | 26 px | Thẻ kính |
| `--r-tile` | 22 px | Ô giữ chỗ ở thẻ và trang chi tiết |
| `--r-dialog` | 30 px | Hộp thoại |
| `--r-field` | 14 px | Ô nhập, khung xương mặc định |
| `--r-thumb` | 12 px | Ô giữ chỗ 40×40 ở dòng. Đã đối chiếu: ô biểu tượng của trang mẫu bo 28% (11,2 px ở 40 px) |
| `--r-ctl` | 999 px | Nút, huy hiệu, ô tìm |
| Ô "well" | 18 px | `.well`. Đã đo |
| `--card-shadow` | Tối: bảy lớp của trang mẫu (`inset 0 1px 1px #ffffff4d` … `0 24px 48px -22px #000000bf`). Sáng: `inset 0 1px 1px #ffffffcc, 0 1px 2px #0f17240f, 0 18px 40px -22px #0f172447` | Thẻ kính |
| `--button-shadow` | Tối: `inset 0 1px 0 #ffffff47, inset 0 -1px 0 #0000001f, 0 6px 16px -6px #7aaef0a6` (đã đo, khớp). Sáng: `0 6px 16px -8px #2b63c499` (ước lượng: trang mẫu không có giao diện sáng) | Nút chính |
| `--blur`, `--sat` | 14 px, 175% | `backdrop-filter` của thẻ |
| `--blur-thick` | 30 px | Màn che sau hộp thoại |

Không có `backdrop-filter`, hay `prefers-reduced-transparency: reduce`: `.card` dùng nền `--solid`. Không dùng bộ lọc SVG của trang mẫu.

### Chuyển động

| Token | Giá trị |
|---|---|
| `--ease` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--dur-fast`, `--dur`, `--dur-slow` | 150, 200, 250 ms. Đã đối chiếu (xem Số đo) |

`prefers-reduced-motion: reduce` đặt ba thời lượng về 0 và tắt nhấp nháy của khung xương.

### Điểm ngắt

640, 768, 1024, 1440 px (`sm`, `md`, `lg`, `xl`). CSS variables không dùng được trong media query, nên viết số trực tiếp, như `@media (width < 768px)`. `user` hỗ trợ từ 320 px, không có thanh cuộn ngang: đã kiểm trang chủ và trang Giới thiệu ở 390 px (`scrollWidth` bằng bề rộng). Dưới 768 px: h1 28 px; ô nhập dùng chữ 16 px vì iOS phóng to trang khi ô nhập nhỏ hơn. Thanh điều hướng: một hàng từ 768 px, hai hàng dưới 768 px (SHOP-11, mục Page Frame); hai điểm ngắt theo nội dung, 1024 px (biểu tượng thay chữ) và 390 px (tên site xuống hai dòng). Đã kiểm 320, 390, 767, 768, 1024, 1440 px không cuộn ngang (`apps/user/e2e/site-frame.spec.ts`). Lưới sản phẩm 1, 2, 3, 4 cột thuộc Story của S4.

## Số đo

`design.md` giao `fe-dev` đối chiếu các giá trị "ước lượng" với trang mẫu (https://demo.codeandchill.store/vitrea/, trang Growth và Apps, 1600×1000, giao diện tối) bằng chrome-devtools, ngày 2026-11-15. Đo bằng `getComputedStyle` và `getBoundingClientRect`.

| Giá trị | Ước lượng của `design.md` | Số đo | Dùng |
|---|---|---|---|
| Huy hiệu trạng thái ("Running", "Draft", "Finished") | Cao 24, chấm 6, chữ 12/600, đệm 4 10 | Cao 25,4; đệm 4 10; chữ 12/17,4, 600; chấm 7 px tròn; cách chữ 6 px. Nền: fill ở 13% (Running) và 14% (Finished); "Draft" chữ text trên nền well | Số đo, trừ nền: giữ tint 14% (sáng) và 16% (tối) của bảng Design System, vì bảng không ghi là ước lượng và tương phản đã tính theo nó |
| Màu "-16%" | Coral, ước lượng; bảng ghi bad | Mức giảm "▼ −7.1%" của trang mẫu là bad #f6a59c, 12/700 | bad (`--danger-text` trên `--danger-tint`), như bảng |
| Tiêu đề trang | 34/36, 700; 26 ở điện thoại | "Growth Lab": 38/39,52, 600, letter-spacing -0,95 px (-0,025em); 28/29,12 ở cửa sổ hẹp | Số đo |
| Chữ cái đầu của ô giữ chỗ | 40% chiều cao ô | Trang mẫu không có ô chữ cái cùng loại: chữ của avatar "NH" 13/38 (34%), chữ của logo 21/38 (55%) | Giữ 40%, nằm giữa hai số đo |
| Bo góc ô giữ chỗ ở dòng | 12 px | Ô biểu tượng 38 px và 52 px bo 28% (10,6 và 14,6 px) | Giữ 12 px (28% của 40 là 11,2) |
| Thời lượng chuyển động | 150 đến 250 ms | Dòng bảng 150 ms, tooltip 150 và 180 ms, công tắc 250 ms, màn che hộp thoại 300 ms, chớp 900 ms; tất cả `--ease`; về 0 khi giảm chuyển động | 150, 200, 250 ms; màn che hộp thoại có thể dùng 300 ms |
| `button-shadow` tối | Ước lượng | Khớp: `rgba(255,255,255,.28) 0 1px 0 inset, rgba(0,0,0,.12) 0 -1px 0 inset, accent 65% 0 6px 16px -6px` | Như bảng |
| Ô "well" | Không có số | Khối "Downloads, 30 days" của trang Apps: nền well, đệm 12 14, bo 18 | Số đo |

`admin` (SHOP-8) dùng các ước lượng. `docs/design-system/admin.md` ghi rằng các giá trị "ước lượng" của nó chưa đối chiếu. Các số đo ở bảng trên áp cho `admin` ở SHOP-9.

## Classes

| Class | Component của `design.md` | Ghi chú |
|---|---|---|
| `.btn .btn--primary` | Nút chính | Cao 42, đệm 0 18, bo 999, chữ 13,5/600, nền `--primary`, `--button-shadow`; hover `--primary-hover`; active lún 1 px; `:disabled` hay `aria-disabled="true"` mờ 50%. Đang lưu: đổi chữ, `aria-busy`, khóa; không khóa trước khi gửi form |
| `.btn .btn--secondary` | Nút phụ | Nền `--secondary`, viền `--border-strong`, chữ `--secondary-foreground`; hover nền `--border-strong` |
| `.btn--sm` | Nút phụ 34 | Cao 34, đệm 0 14, chữ 12,5/600; như Xem thêm (S4.10) |
| `.badge .badge--info`, `--neutral`, `--good`, `--warn`, `--bad` | Huy hiệu trạng thái | Cao 25,4, đệm 4 10, chấm 7 px cách chữ 6, chữ 12/600; luôn có chữ. Đang bán `info`, Ẩn `neutral`, Còn hàng `good`, Hết hàng `warn`, "-16%" `bad` |
| `.badge--plain` | Huy hiệu "-16%" | Bỏ chấm. Đặt chữ ẩn "Giảm" trước số bằng `.visually-hidden` |
| `.card` | Thẻ kính | Nền `--surface`, blur 14 px và bão hòa 175%, bo 26, đệm 18, `--card-shadow`, không viền |
| `.well` | Ô "well" (S5) | Nền `--well`, đệm 12 14, bo 18; đặt trong `.card` |
| `.label` | Nhãn trường | 14/500 `--foreground`, cách ô 4. Trường bắt buộc: dấu `*` có `aria-hidden="true"`, ô có `required` |
| `.input` | Ô nhập, vùng văn bản, ô chọn | Dùng cho `<input>`, `<textarea>` (cao tối thiểu 144) và `<select>` gốc. Cao 44, bo 14, đệm 10 14, nền `--muted`, viền `--control-border`, chữ 14/500 (16 dưới 768 px). Focus: viền `--ring` và vầng 3 px `--focus-halo`. Lỗi: `aria-invalid="true"` thì viền `--danger-text`. Khóa: mờ 50% |
| `.field-error` | Dòng lỗi | 12,5/500 `--danger-text`, cách ô 4; đặt biểu tượng trước chữ; gắn vào ô bằng `aria-describedby` |
| `.search`, `.search__icon`, `.search__input` | Ô tìm (S4.3) | Viên thuốc cao 44, kính lúp 16 px `--hint` bên trái (`aria-hidden`), chữ cách trái 40. Dùng cùng `.input` |
| `.skeleton` | Khung xương | Nền `--muted`, nhấp nháy 1,2 s, tắt khi giảm chuyển động; đặt `border-radius` như phần tử thật; vùng chứa có `aria-busy="true"` |
| `.visually-hidden` | | Chữ chỉ cho trình đọc màn hình: nhãn ẩn "Tìm theo tên", "Giảm", "Giá gốc:" |
| `.tile`, `.tile--card`, `.tile--detail`, `.tile--row`, `.tile--<nhóm>`, `.tile__initial` | Ô giữ chỗ | Do `PlaceholderTile` đặt; không dùng tay |
| `.product-page`, `.back-link`, `.product-detail`, `.product-detail__body`, `__name`, `__about`, `__description`, `.product-price`, `__label`, `__row`, `__value`, `__was` | Trang chi tiết S5 (SHOP-23) | Do `ProductDetail` (`src/features/product/components/product-detail.tsx`) đặt. `<main>` rộng tối đa 64rem; một thẻ kính hai cột 2fr 3fr (ô giữ chỗ 1:1 chiếm 40%), một cột dưới 768 px với ô 4:3. Tên h1 26/700 (22 dưới 768 px), `overflow-wrap: anywhere`. Giá trong `.well`: nhãn 12,5 `--muted-foreground`, giá 34/700 (26 dưới 768 px), giá gốc 13,5 `--hint` trong `<s>` kèm chữ ẩn, huy hiệu `.badge--bad .badge--plain`. Mô tả `white-space: pre-line`. Khung xương `ProductDetailSkeleton` cùng hình |
| `.site-shell`, `.site-nav`, `.pill`, `.pill--brand`, `.pill__link`, `.nav-group`, `.nav-btn`, `.nav-btn--text`, `.nav-btn__icon`, `.nav-btn__label`, `.nav-account`, `.site-footer` | Viên thuốc điều hướng (S4.1), chân trang (S4.11) | Do `SiteNav`, các nút chuyển và `SiteFooter` đặt; xem mục Page Frame |

Tên class giống `admin` (`apps/admin/src/styles/components.css` của SHOP-8), để một màn hình đọc như nhau ở hai app.

## Page Frame

Khung của mọi trang `user` (SHOP-11): `.site-shell` rộng tối đa `--app-max` (1840 px), lề ngang `--gutter`, đệm trên 18 dưới 28; chân trang đẩy mình xuống (`margin-top: auto`) để nằm cuối trang ngắn, nên phần trang đặt sau `<main>` (như các liên kết demo của trang chủ) vẫn đi liền với trang (SHOP-41). `<main>` của từng trang giữ 48rem, không còn lề ngang riêng (lề là của khung). `global-error.tsx` cũng bọc `<main>` trong `.site-shell`.

**Thanh điều hướng S4.1** (`SiteNav`, `<header>`): ba viên `.pill`, như `admin` (SHOP-8).

| Phần | Giá trị |
|---|---|
| Viên | Cao 49,6 (mục 39,6 trong đệm 5), bo `--r-ctl`, nền `--surface`, `--card-shadow`, kính `--blur` `--sat`; nền `--solid` khi không có `backdrop-filter` hay khi giảm độ trong suốt |
| Tên site `.pill--brand` | Liên kết về trang chủ, 15/700, đệm 0 24. Không phải h1: mỗi trang có h1 riêng |
| Điều hướng `.pill__link` | `<nav aria-label="Điều hướng chính">`: Trang chủ, Sản phẩm, Giới thiệu (`model/nav.ts`). Cao 39,6, đệm 10 16, 13,5/600. Mục đang chọn là liên kết có `aria-current="page"`, nền `--muted`, chọn bằng thuộc tính đó; Sản phẩm là mục đang chọn ở cả `/products/<slug>`. Hover nền `--muted` |
| Tiện ích `.nav-btn` | Theo thứ tự: nhóm Ngôn ngữ (`role=group`, nút EN, VI chữ, ngôn ngữ hiện tại `aria-current="true"` và khóa), nhóm Giao diện (`role=group`, Sáng, Tối, Hệ thống, `aria-pressed`), tài khoản (`AuthStatus`: Đăng nhập; hoặc Tài khoản, vai trò, Đăng xuất). Nút cao 39,6, tối thiểu 39,6 rộng, bo `--r-ctl`, 13,5/600; mục đang chọn nền `--border-strong` (line-2, như nút phân đoạn), hover `--muted` |
| Biểu tượng | Từ 1024 px nút Giao diện và tài khoản là chữ; dưới 1024 px là biểu tượng 16 px (`ui/icons.tsx`), chữ và dòng vai trò ẩn như `.visually-hidden` nhưng vẫn là tên của nút. Có `title` để hiện chú thích khi rê chuột |
| 768–1023 px | Một hàng: khoảng cách giữa viên 8, tên site đệm 0 16, mục điều hướng đệm 10 12, nút biểu tượng rộng 36. Đo ở 768 px: vừa, còn dư |
| Dưới 768 px | Hai hàng, không có menu ẩn: hàng 1 tên site (13,5/700, cao 40) và viên tiện ích (cao 40, nút 30×32, trên mức 24 px của WCAG 2.5.8); hàng 2 viên điều hướng hết bề rộng, ba mục chia đều. Là hàng flex có xuống dòng, không phải lưới: với chữ lớn hơn, viên tiện ích xuống hàng riêng thay vì chồng lên tên site hay gây cuộn ngang |
| Dưới 390 px | Tên site xuống hai dòng, 12,5/700, đệm 0 10, để hàng 1 vừa 320 px. Đo ở 320 px: tên 83, tiện ích 194, dư 7 px; ở 390 px tên một dòng 151, dư 9 px |

Khi đã đăng nhập (bản demo cũ, Epic đăng nhập sẽ thay), viên tiện ích dài hơn: ở 320 px và ở 1024 px nó xuống hàng riêng, không cuộn ngang.

**Chân trang S4.11** (`SiteFooter`, `<footer class="site-footer">`): dòng bản quyền, `--hint` 12,5 px, căn giữa, cách trang 24.

**Kiểm tra:** `apps/user/e2e/site-frame.spec.ts` (mục đang chọn, số hàng và cuộn ngang ở 320, 390, 767, 768, 1024, 1440 px, biểu tượng giữ tên); `apps/user/e2e/accessibility.spec.ts` thêm axe ở 320 px, sáng và tối.

## Components Built Later

Một dòng Component của bảng Design System là của `user` nhưng chưa có class: chúng là bố cục của một màn hình, nên item làm màn hình đó dựng chúng từ token và class ở trên, rồi chuyển dòng của chúng lên mục Classes. Giá trị dưới đây là của `design.md`, chưa đo lại.

| Component của `design.md` | Giá trị | Làm ở |
|---|---|---|
| Thẻ sản phẩm (S4.6) | Thẻ kính `.card`, đệm 18. Ô giữ chỗ 4:3 (`PlaceholderTile`). Tên 15/600 (`--fs-lg`), tối đa 2 dòng. Giá bán 17/700 (`--fs-xl`, `--fw-bold`); giá gốc 13,5/500 `--hint` gạch ngang; huy hiệu "-xx%" `.badge--bad .badge--plain`. Huy hiệu Hết hàng đè góc trên trái ô. Hover nâng 2 px và sáng viền; `:focus-visible` vòng `--ring`. Cả thẻ là một liên kết | SHOP-25 (US5a) |

## PlaceholderTile

`src/components/ui/placeholder-tile.tsx`, cùng quy tắc với `admin` (plan, mục 15):

```tsx
<PlaceholderTile id={product.id} name={product.name} />                 // thẻ, 4:3, bo 22 (S4.6)
<PlaceholderTile id={product.id} name={product.name} variant="detail" /> // chi tiết, 1:1, bo 22 (S5)
<PlaceholderTile id={product.id} name={product.name} variant="row" />    // dòng, 40×40, bo 12
```

- **Màu nhóm:** `placeholderGroup(id)` là `GROUPS[parseInt(id.slice(-8), 16) % 6]`, với `GROUPS = ['blue', 'coral', 'green', 'orange', 'teal', 'ink']`. Tám ký tự hex cuối của UUIDv7 là phần ngẫu nhiên. Đổi tên hay slug không đổi màu. `id` không kết thúc bằng hex thì nhận nhóm đầu, `blue`.
- **Bộ mẫu dùng chung** cho test của hai app: `admin` (SHOP-9) dùng đúng các cặp này, để một app lệch quy tắc thì test bắt được. Bảy id ghim độ dài khi đi cùng nhau: đọc 1 tới 12 ký tự cuối, trừ 8, thì ít nhất một id ra nhóm khác (`placeholder-tile.test.tsx`). Chỉ hai id, `…06c7400a60ee` và `…c07d23ef7c9d`, tự ghim được mọi độ dài; năm id kia trùng nhóm ở vài độ dài, như `…a1b2c3d4e5f6` ở 1, 2, 6, 7 và 12. Vì vậy test của `admin` dùng đủ bảy id. Id có tiền tố cố định như `…-0123xxxxxxxx` không ghim được độ dài, vì 16^k chia 6 luôn dư 4.

  | id | Nhóm |
  |---|---|
  | `0192f1c4-7a3b-7c2d-8e9f-a1b2c3d4e5f6` | blue |
  | `0193a2b5-29ba-7b09-a5ad-06c7400a60ee` | blue |
  | `0193a2b5-fce1-786a-b348-e4314aad4353` | coral |
  | `0193a2b5-c906-7d72-8299-4a1d1f241b6a` | green |
  | `0193a2b5-0091-770e-851f-c07d23ef7c9d` | orange |
  | `0193a2b5-0da4-72b1-bdb4-0727dd873f80` | teal |
  | `0193a2b5-02b2-7292-afeb-59babb00064f` | ink |

- **Chữ:** `placeholderInitial(name)` bỏ mọi khoảng trắng, chuẩn hóa NFC, lấy ký tự đầu (theo code point, nên một chữ gõ kiểu tổ hợp như "a" + dấu sắc vẫn là "Á"), rồi `toLocaleUpperCase('vi')`. Tên rỗng cho chuỗi rỗng.
- Ô là `<span aria-hidden="true">` có `data-group` và `data-variant`, nên dùng được trong một liên kết; tên sản phẩm phải có ở chữ của liên kết. Chữ cái 700, 40% chiều cao ô: `.tile` là container của chính nó, và chữ đặt bằng `cqi` (30cqi ở ô 4:3, 40cqi ở ô vuông).

## Not Yet Built

- Thẻ sản phẩm S4.6 (giá trị ở Components Built Later) và lưới S4.5: SHOP-25 (US5a).
- Giá: `formatPrice` và `discountPercent` ở `src/features/product/model/product.ts` (SHOP-23), dùng cho mọi chỗ hiện giá; thẻ S4.6 dùng lại chúng.
